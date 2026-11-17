//! Zyntheo sidecar: length-prefixed JSON envelopes on stdout; diagnostics on stderr.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{stdin, stdout, Write};
use std::sync::{Arc, Mutex};
use zyntheo_core::{
    current_rss_bytes, CancelToken, JobGate, ResourceLimits, PROTOCOL_VERSION, SERVICE_NAME,
    SIDECAR_API_VERSION,
};
use zyntheo_fs::{list_tree, stat_paths};
use zyntheo_index::WorkspaceIndex;
use zyntheo_ipc::{
    check_protocol_version, read_message, write_message, BuildIndexPayload, CancelPayload,
    HealthResult, ListTreePayload, RequestEnvelope, ResponseEnvelope, SearchPayload,
    StatPathsPayload, TreeResultJson, WatchIdPayload, WatchStartPayload,
};
use zyntheo_search::{search_text, SearchOptions};
use zyntheo_watch::WatchHub;

fn eprint_log(msg: impl AsRef<str>) {
    let _ = writeln!(std::io::stderr(), "[zyntheo-sidecar] {}", msg.as_ref());
}

fn main() {
    let limits = ResourceLimits::default();
    let index = WorkspaceIndex::new(8);
    let watches = WatchHub::new(8, 10_000);
    let jobs = JobGate::new(limits.max_concurrency);
    let active: Arc<Mutex<HashMap<String, CancelToken>>> = Arc::new(Mutex::new(HashMap::new()));
    let mut input = stdin().lock();
    let mut output = stdout().lock();

    eprint_log(format!(
        "started protocol={PROTOCOL_VERSION} api={SIDECAR_API_VERSION} max_concurrency={}",
        jobs.max()
    ));

    loop {
        let req: RequestEnvelope = match read_message(&mut input, &limits) {
            Ok(r) => r,
            Err(e) => {
                eprint_log(format!("read error: {}", e.safe_message()));
                let _ = write_message(
                    &mut output,
                    &ResponseEnvelope::from_zyntheo("0", &e),
                    &limits,
                );
                break;
            }
        };

        if let Err(e) = check_protocol_version(req.protocol_version) {
            let _ = write_message(
                &mut output,
                &ResponseEnvelope::from_zyntheo(&req.id, &e),
                &limits,
            );
            break;
        }

        let cancel = CancelToken::new();
        if let Ok(mut g) = active.lock() {
            g.insert(req.id.clone(), cancel.clone());
        }

        let resp = dispatch(&req, &limits, &index, &watches, &jobs, &cancel, &active);
        if let Ok(mut g) = active.lock() {
            g.remove(&req.id);
        }

        if write_message(&mut output, &resp, &limits).is_err() {
            eprint_log("stdout write failed; exiting");
            break;
        }

        if req.op == "shutdown" {
            watches.clear();
            index.clear();
            eprint_log("shutdown acknowledged");
            break;
        }
    }
}

fn dispatch(
    req: &RequestEnvelope,
    limits: &ResourceLimits,
    index: &WorkspaceIndex,
    watches: &WatchHub,
    jobs: &JobGate,
    cancel: &CancelToken,
    active: &Arc<Mutex<HashMap<String, CancelToken>>>,
) -> ResponseEnvelope {
    match req.op.as_str() {
        "ping" | "health" => {
            let health = HealthResult {
                service: SERVICE_NAME.to_string(),
                api_version: SIDECAR_API_VERSION.to_string(),
                protocol_version: PROTOCOL_VERSION,
                pid: std::process::id(),
            };
            match serde_json::to_value(health) {
                Ok(v) => ResponseEnvelope::ok(&req.id, v),
                Err(e) => ResponseEnvelope::err(
                    &req.id,
                    zyntheo_core::ErrorCode::Internal,
                    e.to_string(),
                ),
            }
        }
        "resource_stats" => {
            let (index_roots, index_entries) = index.stats();
            ResponseEnvelope::ok(
                &req.id,
                json!({
                    "rss_bytes": current_rss_bytes(),
                    "jobs_active": jobs.active(),
                    "jobs_max": jobs.max(),
                    "index_cached_roots": index_roots,
                    "index_entries": index_entries,
                    "watches": watches.len(),
                    "pid": std::process::id(),
                }),
            )
        }
        "list_tree" => match parse_payload::<ListTreePayload>(&req.payload) {
            Ok(p) => {
                let permit = match jobs.try_enter() {
                    Ok(p) => p,
                    Err(e) => return ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                let out = match list_tree(
                    std::path::Path::new(&p.root),
                    limits,
                    p.max_depth,
                    p.max_files,
                    cancel,
                ) {
                    Ok(tree) => ResponseEnvelope::ok(
                        &req.id,
                        serde_json::to_value(TreeResultJson {
                            root: tree.root.to_string_lossy().into_owned(),
                            entries: tree.entries,
                            truncated: tree.truncated,
                        })
                        .unwrap_or(Value::Null),
                    ),
                    Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                drop(permit);
                out
            }
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "list_files" => match parse_payload::<ListTreePayload>(&req.payload) {
            Ok(p) => {
                let permit = match jobs.try_enter() {
                    Ok(p) => p,
                    Err(e) => return ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                // Dedupe: reuse index cache when fresh instead of a second walk.
                let out = match index.list_files_deduped(
                    std::path::Path::new(&p.root),
                    limits,
                    p.max_files,
                    cancel,
                ) {
                    Ok((entries, truncated, cache_hit)) => ResponseEnvelope::ok(
                        &req.id,
                        json!({
                            "root": p.root,
                            "entries": entries,
                            "truncated": truncated,
                            "cache_hit": cache_hit,
                        }),
                    ),
                    Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                drop(permit);
                out
            }
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "build_index" => match parse_payload::<BuildIndexPayload>(&req.payload) {
            Ok(p) => {
                let permit = match jobs.try_enter() {
                    Ok(p) => p,
                    Err(e) => return ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                let out = match index.build(
                    std::path::Path::new(&p.root),
                    limits,
                    p.max_depth,
                    p.max_files,
                    cancel,
                ) {
                    Ok(snap) => ResponseEnvelope::ok(
                        &req.id,
                        json!({
                            "root": snap.root,
                            "entries": snap.entries,
                            "truncated": snap.truncated,
                            "built_at_epoch_secs": snap.built_at_epoch_secs,
                            "root_mtime_epoch_secs": snap.root_mtime_epoch_secs,
                        }),
                    ),
                    Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                drop(permit);
                out
            }
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "refresh_index" => match parse_payload::<BuildIndexPayload>(&req.payload) {
            Ok(p) => {
                let permit = match jobs.try_enter() {
                    Ok(p) => p,
                    Err(e) => return ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                let out = match index.refresh_if_stale(
                    std::path::Path::new(&p.root),
                    limits,
                    cancel,
                ) {
                    Ok((snap, rebuilt)) => ResponseEnvelope::ok(
                        &req.id,
                        json!({
                            "root": snap.root,
                            "entries": snap.entries,
                            "truncated": snap.truncated,
                            "built_at_epoch_secs": snap.built_at_epoch_secs,
                            "root_mtime_epoch_secs": snap.root_mtime_epoch_secs,
                            "rebuilt": rebuilt,
                        }),
                    ),
                    Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                drop(permit);
                out
            }
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "watch_start" => match parse_payload::<WatchStartPayload>(&req.payload) {
            Ok(p) => match watches.start(std::path::Path::new(&p.root), p.debounce_ms) {
                Ok(watch_id) => ResponseEnvelope::ok(&req.id, json!({ "watch_id": watch_id })),
                Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
            },
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "watch_poll" => match parse_payload::<WatchIdPayload>(&req.payload) {
            Ok(p) => match watches.poll(&p.watch_id, p.max_events) {
                Ok((events, truncated)) => ResponseEnvelope::ok(
                    &req.id,
                    json!({ "events": events, "truncated": truncated }),
                ),
                Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
            },
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "watch_stop" => match parse_payload::<WatchIdPayload>(&req.payload) {
            Ok(p) => match watches.stop(&p.watch_id) {
                Ok(()) => ResponseEnvelope::ok(&req.id, json!({ "stopped": p.watch_id })),
                Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
            },
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "search" => match parse_payload::<SearchPayload>(&req.payload) {
            Ok(p) => {
                let permit = match jobs.try_enter() {
                    Ok(p) => p,
                    Err(e) => return ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                let opts = SearchOptions {
                    query: p.query,
                    case_sensitive: p.case_sensitive.unwrap_or(false),
                    literal: p.literal.unwrap_or(true),
                    max_matches: p.max_matches.unwrap_or(200),
                    max_files: p.max_files.unwrap_or(5_000),
                    max_file_bytes: p.max_file_bytes.unwrap_or(limits.max_file_bytes),
                };
                let out = match search_text(std::path::Path::new(&p.root), &opts, limits, cancel)
                {
                    Ok(res) => ResponseEnvelope::ok(
                        &req.id,
                        json!({
                            "matches": res.matches,
                            "files_scanned": res.files_scanned,
                            "truncated": res.truncated,
                        }),
                    ),
                    Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
                };
                drop(permit);
                out
            }
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "stat_paths" => match parse_payload::<StatPathsPayload>(&req.payload) {
            Ok(p) => {
                let root = p.root.as_deref().map(std::path::Path::new);
                match stat_paths(root, &p.paths, p.max_paths.unwrap_or(1_000), cancel) {
                    Ok((entries, truncated)) => ResponseEnvelope::ok(
                        &req.id,
                        json!({
                            "entries": entries.iter().map(|m| json!({
                                "path": m.path,
                                "is_dir": m.is_dir,
                                "size": m.size,
                                "mtime_epoch_secs": m.mtime_epoch_secs,
                            })).collect::<Vec<_>>(),
                            "truncated": truncated,
                        }),
                    ),
                    Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
                }
            }
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "cancel" => match parse_payload::<CancelPayload>(&req.payload) {
            Ok(p) => {
                if let Ok(g) = active.lock() {
                    if let Some(token) = g.get(&p.target_id) {
                        token.cancel();
                    }
                }
                ResponseEnvelope::ok(&req.id, json!({ "cancelled": p.target_id }))
            }
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "shutdown" => ResponseEnvelope::ok(&req.id, json!({ "bye": true })),
        other => ResponseEnvelope::err(
            &req.id,
            zyntheo_core::ErrorCode::Protocol,
            format!("unknown op: {other}"),
        ),
    }
}

fn parse_payload<T: serde::de::DeserializeOwned>(
    value: &Value,
) -> Result<T, zyntheo_core::ZyntheoError> {
    serde_json::from_value(value.clone())
        .map_err(|e| zyntheo_core::ZyntheoError::Protocol(e.to_string()))
}
