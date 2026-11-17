//! Bounded content search — no shell, allowlisted root walk only.

use ignore::WalkBuilder;
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use zyntheo_core::{should_exclude_dir_name, CancelToken, ResourceLimits, ZyntheoError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub path: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub matches: Vec<SearchMatch>,
    pub files_scanned: usize,
    pub truncated: bool,
}

#[derive(Debug, Clone)]
pub struct SearchOptions {
    pub query: String,
    pub case_sensitive: bool,
    pub literal: bool,
    pub max_matches: usize,
    pub max_files: usize,
    pub max_file_bytes: usize,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            query: String::new(),
            case_sensitive: false,
            literal: true,
            max_matches: 200,
            max_files: 5_000,
            max_file_bytes: 2 * 1024 * 1024,
        }
    }
}

pub fn search_text(
    root: &Path,
    opts: &SearchOptions,
    limits: &ResourceLimits,
    cancel: &CancelToken,
) -> Result<SearchResult, ZyntheoError> {
    if opts.query.is_empty() {
        return Err(ZyntheoError::Protocol("empty search query".into()));
    }
    if !root.exists() {
        return Err(ZyntheoError::NotFound(root.display().to_string()));
    }

    let max_matches = opts.max_matches.min(10_000).max(1);
    let max_files = opts.max_files.min(limits.max_files).max(1);
    let max_file_bytes = opts.max_file_bytes.min(limits.max_file_bytes).max(1);

    let pattern = if opts.literal {
        RegexBuilder::new(&regex::escape(&opts.query))
    } else {
        RegexBuilder::new(&opts.query)
    }
    .case_insensitive(!opts.case_sensitive)
    .build()
    .map_err(|e| ZyntheoError::Protocol(format!("invalid regex: {e}")))?;

    let mut matches = Vec::new();
    let mut files_scanned = 0usize;
    let mut truncated = false;

    let walker = WalkBuilder::new(root)
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
        if matches.len() >= max_matches {
            truncated = true;
            break;
        }
        let dent = match dent {
            Ok(d) => d,
            Err(_) => continue,
        };
        if !dent.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        if files_scanned >= max_files {
            truncated = true;
            break;
        }
        files_scanned += 1;

        let path = dent.path();
        if looks_binary(path, max_file_bytes) {
            continue;
        }
        let file = match File::open(path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let meta_len = file.metadata().map(|m| m.len() as usize).unwrap_or(0);
        if meta_len > max_file_bytes {
            continue;
        }

        let reader = BufReader::new(file);
        let rel = path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");

        for (idx, line_res) in reader.lines().enumerate() {
            cancel.check()?;
            if matches.len() >= max_matches {
                truncated = true;
                break;
            }
            let Ok(line) = line_res else { break };
            if let Some(m) = pattern.find(&line) {
                let column = (m.start() + 1) as u32;
                let text = if line.len() > 400 {
                    format!("{}…", &line[..400])
                } else {
                    line
                };
                matches.push(SearchMatch {
                    path: rel.clone(),
                    line: (idx + 1) as u32,
                    column,
                    text,
                });
            }
        }
    }

    Ok(SearchResult {
        matches,
        files_scanned,
        truncated,
    })
}

fn looks_binary(path: &Path, max_probe: usize) -> bool {
    let Ok(mut f) = File::open(path) else {
        return true;
    };
    let mut buf = vec![0u8; 8192.min(max_probe)];
    let Ok(n) = f.read(&mut buf) else {
        return true;
    };
    buf[..n].contains(&0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn finds_literal_match() {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("zyntheo-search-{nanos}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::write(dir.join("src/a.rs"), b"fn hello_zyntheo() {}\n").unwrap();
        fs::write(dir.join("src/b.rs"), b"fn other() {}\n").unwrap();
        let opts = SearchOptions {
            query: "hello_zyntheo".into(),
            ..SearchOptions::default()
        };
        let res = search_text(&dir, &opts, &ResourceLimits::default(), &CancelToken::new()).unwrap();
        assert_eq!(res.matches.len(), 1);
        assert!(res.matches[0].path.contains("a.rs"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn empty_query_errors() {
        let err = search_text(
            Path::new("."),
            &SearchOptions::default(),
            &ResourceLimits::default(),
            &CancelToken::new(),
        );
        assert!(err.is_err());
    }
}
