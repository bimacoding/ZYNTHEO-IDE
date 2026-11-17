//! Bounded directory listing for AI context / directory strings.

use ignore::WalkBuilder;
use std::path::{Path, PathBuf};
use zyntheo_core::{CancelToken, ResourceLimits, ZyntheoError};

#[derive(Debug, Clone)]
pub struct TreeResult {
    pub root: PathBuf,
    pub entries: Vec<String>,
    pub truncated: bool,
}

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
        return Err(ZyntheoError::Other(format!(
            "root does not exist: {}",
            root.display()
        )));
    }

    let mut entries = Vec::new();
    let mut truncated = false;

    let walker = WalkBuilder::new(root)
        .max_depth(Some(max_depth))
        .hidden(false)
        .git_ignore(true)
        .git_global(true)
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn lists_bounded_tree() {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("zyntheo-fs-test-{nanos}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("a/b")).unwrap();
        fs::write(dir.join("a/b/c.txt"), b"hi").unwrap();
        let limits = ResourceLimits {
            max_files: 10,
            max_depth: 5,
            ..ResourceLimits::default()
        };
        let res = list_tree(&dir, &limits, None, None, &CancelToken::new()).unwrap();
        assert!(!res.entries.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
