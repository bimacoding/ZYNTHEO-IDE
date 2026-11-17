//! Bounded directory listing for AI context / directory strings.

use ignore::WalkBuilder;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use zyntheo_core::{should_exclude_dir_name, CancelToken, ResourceLimits, ZyntheoError};

#[derive(Debug, Clone)]
pub struct TreeResult {
    pub root: PathBuf,
    pub entries: Vec<String>,
    pub truncated: bool,
}

#[derive(Debug, Clone)]
pub struct FileMeta {
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub mtime_epoch_secs: u64,
}

/// Walk workspace tree with gitignore + TypeScript-aligned directory excludes.
pub fn list_tree(
    root: &Path,
    limits: &ResourceLimits,
    max_depth: Option<usize>,
    max_files: Option<usize>,
    cancel: &CancelToken,
) -> Result<TreeResult, ZyntheoError> {
    let max_depth = max_depth.unwrap_or(limits.max_depth);
    let max_files = max_files.unwrap_or(limits.max_files);

    if !root.exists() {
        return Err(ZyntheoError::NotFound(root.display().to_string()));
    }

    let mut entries = Vec::new();
    let mut truncated = false;

    let walker = WalkBuilder::new(root)
        .max_depth(Some(max_depth))
        .hidden(false)
        .git_ignore(true)
        .git_global(true)
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy();
            if entry.depth() > 0 && entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                !should_exclude_dir_name(&name)
            } else {
                true
            }
        })
        .build();

    for dent in walker {
        cancel.check()?;
        let dent = match dent {
            Ok(d) => d,
            Err(_) => continue,
        };
        if entries.len() >= max_files {
            truncated = true;
            break;
        }
        let path = dent.path();
        let rel = path.strip_prefix(root).unwrap_or(path);
        let mut s = rel.to_string_lossy().replace('\\', "/");
        if dent.file_type().map(|t| t.is_dir()).unwrap_or(false) && !s.is_empty() {
            s.push('/');
        }
        if !s.is_empty() {
            entries.push(s);
        }
    }

    Ok(TreeResult {
        root: root.to_path_buf(),
        entries,
        truncated,
    })
}

/// Collect relative file paths only (no directories), for URI-list style consumers.
pub fn list_file_paths(
    root: &Path,
    limits: &ResourceLimits,
    max_files: Option<usize>,
    cancel: &CancelToken,
) -> Result<TreeResult, ZyntheoError> {
    let tree = list_tree(root, limits, None, max_files, cancel)?;
    let files: Vec<String> = tree
        .entries
        .into_iter()
        .filter(|e| !e.ends_with('/'))
        .collect();
    let truncated = tree.truncated || files.len() >= max_files.unwrap_or(limits.max_files);
    Ok(TreeResult {
        root: tree.root,
        entries: files,
        truncated,
    })
}

pub fn file_metadata(path: &Path) -> Result<FileMeta, ZyntheoError> {
    let meta = fs::metadata(path)?;
    let mtime_epoch_secs = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok(FileMeta {
        path: path.to_string_lossy().replace('\\', "/"),
        is_dir: meta.is_dir(),
        size: meta.len(),
        mtime_epoch_secs,
    })
}

/// Batch metadata for relative-or-absolute paths under an optional root.
pub fn stat_paths(
    root: Option<&Path>,
    paths: &[String],
    max_paths: usize,
    cancel: &CancelToken,
) -> Result<(Vec<FileMeta>, bool), ZyntheoError> {
    let limit = max_paths.max(1).min(10_000);
    let truncated = paths.len() > limit;
    let mut out = Vec::with_capacity(limit.min(paths.len()));
    for p in paths.iter().take(limit) {
        cancel.check()?;
        let full = match root {
            Some(r) => r.join(p),
            None => PathBuf::from(p),
        };
        match file_metadata(&full) {
            Ok(mut m) => {
                if let Some(r) = root {
                    if let Ok(rel) = full.strip_prefix(r) {
                        m.path = rel.to_string_lossy().replace('\\', "/");
                    }
                }
                out.push(m);
            }
            Err(_) => continue,
        }
    }
    Ok((out, truncated))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("zyntheo-fs-{tag}-{nanos}"))
    }

    #[test]
    fn lists_bounded_tree_and_skips_node_modules() {
        let dir = temp_dir("tree");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("a/b")).unwrap();
        fs::create_dir_all(dir.join("node_modules/pkg")).unwrap();
        fs::write(dir.join("a/b/c.txt"), b"hi").unwrap();
        fs::write(dir.join("node_modules/pkg/x.js"), b"x").unwrap();
        let limits = ResourceLimits {
            max_files: 50,
            max_depth: 8,
            ..ResourceLimits::default()
        };
        let res = list_tree(&dir, &limits, None, None, &CancelToken::new()).unwrap();
        assert!(res.entries.iter().any(|e| e.contains("c.txt")));
        assert!(!res.entries.iter().any(|e| e.contains("node_modules")));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_file_paths_filters_dirs() {
        let dir = temp_dir("files");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::write(dir.join("src/main.rs"), b"fn main(){}").unwrap();
        let res = list_file_paths(&dir, &ResourceLimits::default(), Some(100), &CancelToken::new()).unwrap();
        assert!(res.entries.iter().all(|e| !e.ends_with('/')));
        assert!(res.entries.iter().any(|e| e.ends_with("main.rs")));
        let _ = fs::remove_dir_all(&dir);
    }
}
