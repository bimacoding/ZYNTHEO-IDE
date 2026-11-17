//! Incremental index scaffold — bounded in-memory file list cache.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use zyntheo_core::{CancelToken, ResourceLimits, ZyntheoError};
use zyntheo_fs::list_tree;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IndexSnapshot {
    pub root: PathBuf,
    pub entries: Vec<String>,
    pub truncated: bool,
    pub built_at_epoch_secs: u64,
}

pub fn build_index(
    root: &Path,
    limits: &ResourceLimits,
    cancel: &CancelToken,
) -> Result<IndexSnapshot, ZyntheoError> {
    let tree = list_tree(root, limits, None, None, cancel)?;
    let built_at_epoch_secs = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok(IndexSnapshot {
        root: tree.root,
        entries: tree.entries,
        truncated: tree.truncated,
        built_at_epoch_secs,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_empty_root_errors() {
        let limits = ResourceLimits::default();
        let err = build_index(Path::new("/path/that/does/not/exist-zyntheo"), &limits, &CancelToken::new());
        assert!(err.is_err());
    }
}
