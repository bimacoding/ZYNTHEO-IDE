//! Zyntheo sidecar: length-prefixed JSON envelopes on stdout; diagnostics on stderr.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{stdin, stdout, Write};
use std::sync::{Arc, Mutex};
use zyntheo_core::{
    CancelToken, ResourceLimits, SERVICE_NAME, SIDECAR_API_VERSION, PROTOCOL_VERSION,
};
use zyntheo_fs::{list_file_paths, list_tree};
use zyntheo_index::WorkspaceIndex;
use zyntheo_ipc::{
    check_protocol_version, read_message, write_message, BuildIndexPayload, CancelPayload,
    HealthResult, ListTreePayload, RequestEnvelope, ResponseEnvelope, TreeResultJson,
};

fn eprint_log(msg: impl AsRef<str>) {
    let _ = writeln!(std::io::stderr(), "[zyntheo-sidecar] {}", msg.as_ref());
}

fn main() {
    let limits = ResourceLimits::default();
    let index = WorkspaceIndex::new(8);
    let active: Arc<Mutex<HashMap<String, CancelToken>>> = Arc::new(Mutex::new(HashMap::new()));
    let mut input = stdin().lock();
    let mut output = stdout().lock();

    eprint_log(format!(
        "started protocol={PROTOCOL_VERSION} api={SIDECAR_API_VERSION}"
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
            // Version mismatch is fatal for this process — client should disable Rust.
            break;
        }

        let cancel = CancelToken::new();
        if let Ok(mut g) = active.lock() {
            g.insert(req.id.clone(), cancel.clone());
        }

        let resp = dispatch(&req, &limits, &index, &cancel, &active);
        if let Ok(mut g) = active.lock() {
            g.remove(&req.id);
        }

        if write_message(&mut output, &resp, &limits).is_err() {
            eprint_log("stdout write failed; exiting");
            break;
        }

        if req.op == "shutdown" {
            eprint_log("shutdown acknowledged");
            break;
        }
    }
}

fn dispatch(
    req: &RequestEnvelope,
    limits: &ResourceLimits,
    index: &WorkspaceIndex,
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
        "list_tree" => match parse_payload::<ListTreePayload>(&req.payload) {
            Ok(p) => match list_tree(
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
            },
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "list_files" => match parse_payload::<ListTreePayload>(&req.payload) {
            Ok(p) => match list_file_paths(
                std::path::Path::new(&p.root),
                limits,
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
            },
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "build_index" => match parse_payload::<BuildIndexPayload>(&req.payload) {
            Ok(p) => match index.build(
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
            },
            Err(e) => ResponseEnvelope::from_zyntheo(&req.id, &e),
        },
        "refresh_index" => match parse_payload::<BuildIndexPayload>(&req.payload) {
            Ok(p) => match index.refresh_if_stale(
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
            },
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

fn parse_payload<T: serde::de::DeserializeOwned>(value: &Value) -> Result<T, zyntheo_core::ZyntheoError> {
    serde_json::from_value(value.clone())
        .map_err(|e| zyntheo_core::ZyntheoError::Protocol(e.to_string()))
}
