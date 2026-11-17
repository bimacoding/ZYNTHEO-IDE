//! Bounded in-memory workspace index with cheap incremental refresh.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;
use zyntheo_core::{CancelToken, ResourceLimits, ZyntheoError};
use zyntheo_fs::{file_metadata, list_tree};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IndexSnapshot {
    pub root: PathBuf,
    pub entries: Vec<String>,
    pub truncated: bool,
    pub built_at_epoch_secs: u64,
    pub root_mtime_epoch_secs: u64,
}

/// Process-local index cache keyed by canonical root path.
pub struct WorkspaceIndex {
    inner: Mutex<HashMap<String, IndexSnapshot>>,
    max_cached_workspaces: usize,
}

impl Default for WorkspaceIndex {
    fn default() -> Self {
        Self::new(8)
    }
}

impl WorkspaceIndex {
    pub fn new(max_cached_workspaces: usize) -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            max_cached_workspaces: max_cached_workspaces.max(1),
        }
    }

    pub fn get(&self, root: &Path) -> Option<IndexSnapshot> {
        let key = normalize_root(root);
        self.inner.lock().ok()?.get(&key).cloned()
    }

    pub fn clear(&self) {
        if let Ok(mut g) = self.inner.lock() {
            g.clear();
        }
    }

    pub fn build(
        &self,
        root: &Path,
        limits: &ResourceLimits,
        max_depth: Option<usize>,
        max_files: Option<usize>,
        cancel: &CancelToken,
    ) -> Result<IndexSnapshot, ZyntheoError> {
        let tree = list_tree(root, limits, max_depth, max_files, cancel)?;
        let root_mtime_epoch_secs = file_metadata(root)
            .map(|m| m.mtime_epoch_secs)
            .unwrap_or(0);
        let built_at_epoch_secs = now_secs();
        let snap = IndexSnapshot {
            root: tree.root,
            entries: tree.entries,
            truncated: tree.truncated,
            built_at_epoch_secs,
            root_mtime_epoch_secs,
        };
        self.insert(normalize_root(root), snap.clone());
        Ok(snap)
    }

    /// Rebuild only when root mtime changed or cache miss.
    pub fn refresh_if_stale(
        &self,
        root: &Path,
        limits: &ResourceLimits,
        cancel: &CancelToken,
    ) -> Result<(IndexSnapshot, bool), ZyntheoError> {
        self.refresh_if_stale_with_limits(root, limits, None, None, cancel)
    }

    pub fn refresh_if_stale_with_limits(
        &self,
        root: &Path,
        limits: &ResourceLimits,
        max_depth: Option<usize>,
        max_files: Option<usize>,
        cancel: &CancelToken,
    ) -> Result<(IndexSnapshot, bool), ZyntheoError> {
        let current_mtime = file_metadata(root)
            .map(|m| m.mtime_epoch_secs)
            .unwrap_or(0);
        if let Some(existing) = self.get(root) {
            if existing.root_mtime_epoch_secs == current_mtime {
                return Ok((existing, false));
            }
        }
        let snap = self.build(root, limits, max_depth, max_files, cancel)?;
        Ok((snap, true))
    }

    /// File paths only from cached/fresh index — avoids a second filesystem walk.
    pub fn list_files_deduped(
        &self,
        root: &Path,
        limits: &ResourceLimits,
        max_files: Option<usize>,
        cancel: &CancelToken,
    ) -> Result<(Vec<String>, bool, bool), ZyntheoError> {
        let (snap, rebuilt) =
            self.refresh_if_stale_with_limits(root, limits, None, max_files, cancel)?;
        let limit = max_files.unwrap_or(limits.max_files);
        let mut files: Vec<String> = snap
            .entries
            .into_iter()
            .filter(|e| !e.ends_with('/'))
            .collect();
        let truncated = snap.truncated || files.len() > limit;
        if files.len() > limit {
            files.truncate(limit);
        }
        Ok((files, truncated, !rebuilt))
    }

    pub fn stats(&self) -> (usize, usize) {
        let Ok(g) = self.inner.lock() else {
            return (0, 0);
        };
        let roots = g.len();
        let entries = g.values().map(|s| s.entries.len()).sum();
        (roots, entries)
    }

    fn insert(&self, key: String, snap: IndexSnapshot) {
        let Ok(mut g) = self.inner.lock() else {
            return;
        };
        if g.len() >= self.max_cached_workspaces && !g.contains_key(&key) {
            // Evict an arbitrary entry to stay bounded.
            if let Some(first) = g.keys().next().cloned() {
                g.remove(&first);
            }
        }
        g.insert(key, snap);
    }
}

fn normalize_root(root: &Path) -> String {
    root.canonicalize()
        .unwrap_or_else(|_| root.to_path_buf())
        .to_string_lossy()
        .replace('\\', "/")
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Back-compat helper used by early scaffold call sites.
pub fn build_index(
    root: &Path,
    limits: &ResourceLimits,
    cancel: &CancelToken,
) -> Result<IndexSnapshot, ZyntheoError> {
    WorkspaceIndex::default().build(root, limits, None, None, cancel)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn build_empty_root_errors() {
        let limits = ResourceLimits::default();
        let err = build_index(
            Path::new("/path/that/does/not/exist-zyntheo"),
            &limits,
            &CancelToken::new(),
        );
        assert!(err.is_err());
    }

    #[test]
    fn refresh_skips_rebuild_when_mtime_unchanged() {
        let dir = std::env::temp_dir().join(format!(
            "zyntheo-index-{}",
            now_secs()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("a.txt"), b"a").unwrap();
        let idx = WorkspaceIndex::new(4);
        let limits = ResourceLimits::default();
        let first = idx
            .build(&dir, &limits, None, None, &CancelToken::new())
            .unwrap();
        let (second, rebuilt) = idx
            .refresh_if_stale(&dir, &limits, &CancelToken::new())
            .unwrap();
        assert!(!rebuilt);
        assert_eq!(first.entries.len(), second.entries.len());
        let (files, _, cache_hit) = idx
            .list_files_deduped(&dir, &limits, Some(100), &CancelToken::new())
            .unwrap();
        assert!(cache_hit);
        assert!(files.iter().any(|f| f.ends_with("a.txt")));
        let _ = fs::remove_dir_all(&dir);
    }
}
