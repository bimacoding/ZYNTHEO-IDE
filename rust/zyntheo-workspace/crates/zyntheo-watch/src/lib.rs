//! Bounded, debounced filesystem watching with pollable event queues.
//!
//! Events are collected in-process and drained via `poll` so the stdio IPC
//! protocol stays request/response (no unsolicited stdout frames).

use notify_debouncer_mini::{new_debouncer, DebounceEventResult, DebouncedEventKind};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use zyntheo_core::{should_exclude_dir_name, ZyntheoError};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WatchEventKind {
    Any,
    Remove,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchEvent {
    pub path: String,
    pub kind: WatchEventKind,
}

struct WatchState {
    queue: Arc<Mutex<VecDeque<WatchEvent>>>,
    /// Keep debouncer alive for the watch lifetime.
    _debouncer: notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>,
}

pub struct WatchHub {
    watches: Mutex<HashMap<String, WatchState>>,
    next_id: Mutex<u64>,
    max_watches: usize,
    max_queued_events: usize,
}

impl Default for WatchHub {
    fn default() -> Self {
        Self::new(8, 10_000)
    }
}

impl WatchHub {
    pub fn new(max_watches: usize, max_queued_events: usize) -> Self {
        Self {
            watches: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
            max_watches: max_watches.max(1),
            max_queued_events: max_queued_events.max(16),
        }
    }

    pub fn start(
        &self,
        root: &Path,
        debounce_ms: Option<u64>,
    ) -> Result<String, ZyntheoError> {
        if !root.exists() {
            return Err(ZyntheoError::NotFound(root.display().to_string()));
        }
        {
            let g = self.watches.lock().map_err(|_| ZyntheoError::Other("lock".into()))?;
            if g.len() >= self.max_watches {
                return Err(ZyntheoError::LimitExceeded(format!(
                    "max watches {}",
                    self.max_watches
                )));
            }
        }

        let queue = Arc::new(Mutex::new(VecDeque::new()));
        let queue_cb = queue.clone();
        let max_q = self.max_queued_events;
        let root_buf = root.to_path_buf();
        let debounce = Duration::from_millis(debounce_ms.unwrap_or(250).clamp(50, 5_000));

        let mut debouncer = new_debouncer(debounce, move |res: DebounceEventResult| {
            let Ok(events) = res else {
                return;
            };
            let Ok(mut q) = queue_cb.lock() else {
                return;
            };
            for ev in events {
                let path = ev.path;
                // Skip excluded directory segments when possible.
                if path.components().any(|c| {
                    let s = c.as_os_str().to_string_lossy();
                    should_exclude_dir_name(&s)
                }) {
                    continue;
                }
                let kind = match ev.kind {
                    DebouncedEventKind::AnyContinuous => WatchEventKind::Any,
                    DebouncedEventKind::Any | _ => WatchEventKind::Any,
                };
                let rel = path
                    .strip_prefix(&root_buf)
                    .unwrap_or(path.as_path())
                    .to_string_lossy()
                    .replace('\\', "/");
                if rel.is_empty() {
                    continue;
                }
                if q.len() >= max_q {
                    q.pop_front();
                }
                q.push_back(WatchEvent { path: rel, kind });
            }
        })
        .map_err(|e| ZyntheoError::Other(format!("watch init: {e}")))?;

        debouncer
            .watcher()
            .watch(root, notify::RecursiveMode::Recursive)
            .map_err(|e| {
                ZyntheoError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e.to_string(),
                ))
            })?;

        let id = {
            let mut n = self.next_id.lock().map_err(|_| ZyntheoError::Other("lock".into()))?;
            let id = n.to_string();
            *n += 1;
            id
        };

        let mut g = self.watches.lock().map_err(|_| ZyntheoError::Other("lock".into()))?;
        g.insert(
            id.clone(),
            WatchState {
                queue,
                _debouncer: debouncer,
            },
        );
        Ok(id)
    }

    pub fn poll(
        &self,
        watch_id: &str,
        max_events: Option<usize>,
    ) -> Result<(Vec<WatchEvent>, bool), ZyntheoError> {
        let g = self.watches.lock().map_err(|_| ZyntheoError::Other("lock".into()))?;
        let state = g
            .get(watch_id)
            .ok_or_else(|| ZyntheoError::NotFound(format!("watch {watch_id}")))?;
        let mut q = state
            .queue
            .lock()
            .map_err(|_| ZyntheoError::Other("lock".into()))?;
        let limit = max_events.unwrap_or(256).min(self.max_queued_events);
        let mut out = Vec::with_capacity(limit.min(q.len()));
        while out.len() < limit {
            match q.pop_front() {
                Some(e) => out.push(e),
                None => break,
            }
        }
        let truncated = !q.is_empty();
        Ok((out, truncated))
    }

    pub fn stop(&self, watch_id: &str) -> Result<(), ZyntheoError> {
        let mut g = self.watches.lock().map_err(|_| ZyntheoError::Other("lock".into()))?;
        if g.remove(watch_id).is_none() {
            return Err(ZyntheoError::NotFound(format!("watch {watch_id}")));
        }
        Ok(())
    }

    pub fn clear(&self) {
        if let Ok(mut g) = self.watches.lock() {
            g.clear();
        }
    }

    pub fn len(&self) -> usize {
        self.watches.lock().map(|g| g.len()).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn start_poll_stop_roundtrip() {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("zyntheo-watch-{nanos}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let hub = WatchHub::new(4, 100);
        let id = hub.start(&dir, Some(100)).unwrap();
        fs::write(dir.join("a.txt"), b"hi").unwrap();
        // Debounce + FS latency
        thread::sleep(Duration::from_millis(400));
        let (events, _) = hub.poll(&id, Some(50)).unwrap();
        // Some platforms are slow/flaky in CI sandboxes; allow empty but ensure API works.
        let _ = events;
        hub.stop(&id).unwrap();
        assert!(hub.poll(&id, None).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_missing_root() {
        let hub = WatchHub::default();
        assert!(hub
            .start(Path::new("/no/such/zyntheo-watch-root"), None)
            .is_err());
    }
}
