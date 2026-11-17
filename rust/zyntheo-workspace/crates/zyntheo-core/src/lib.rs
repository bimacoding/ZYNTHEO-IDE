//! Zyntheo core: identity, errors, resource limits, cancellation.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use thiserror::Error;

pub const PRODUCT_NAME: &str = "Zyntheo IDE";
pub const SERVICE_NAME: &str = "zyntheo-sidecar";
/// Wire protocol version negotiated on every request.
pub const PROTOCOL_VERSION: u32 = 1;
pub const SIDECAR_API_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    Cancelled,
    LimitExceeded,
    Protocol,
    Io,
    VersionMismatch,
    NotFound,
    Timeout,
    Unavailable,
    Internal,
}

impl ErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Cancelled => "CANCELLED",
            Self::LimitExceeded => "LIMIT_EXCEEDED",
            Self::Protocol => "PROTOCOL",
            Self::Io => "IO",
            Self::VersionMismatch => "VERSION_MISMATCH",
            Self::NotFound => "NOT_FOUND",
            Self::Timeout => "TIMEOUT",
            Self::Unavailable => "UNAVAILABLE",
            Self::Internal => "INTERNAL",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_files: usize,
    pub max_depth: usize,
    pub max_message_bytes: usize,
    pub max_file_bytes: usize,
    pub max_concurrency: usize,
    pub default_timeout_ms: u64,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_files: 50_000,
            max_depth: 32,
            max_message_bytes: 8 * 1024 * 1024,
            max_file_bytes: 2 * 1024 * 1024,
            max_concurrency: 2,
            default_timeout_ms: 30_000,
        }
    }
}

#[derive(Debug, Error)]
pub enum ZyntheoError {
    #[error("cancelled")]
    Cancelled,
    #[error("limit exceeded: {0}")]
    LimitExceeded(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("protocol: {0}")]
    Protocol(String),
    #[error("version mismatch: {0}")]
    VersionMismatch(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("timeout")]
    Timeout,
    #[error("other: {0}")]
    Other(String),
}

impl ZyntheoError {
    pub fn code(&self) -> ErrorCode {
        match self {
            Self::Cancelled => ErrorCode::Cancelled,
            Self::LimitExceeded(_) => ErrorCode::LimitExceeded,
            Self::Io(_) => ErrorCode::Io,
            Self::Protocol(_) => ErrorCode::Protocol,
            Self::VersionMismatch(_) => ErrorCode::VersionMismatch,
            Self::NotFound(_) => ErrorCode::NotFound,
            Self::Timeout => ErrorCode::Timeout,
            Self::Other(_) => ErrorCode::Internal,
        }
    }

    /// Public-facing message without dumping large path trees.
    pub fn safe_message(&self) -> String {
        match self {
            Self::Cancelled => "cancelled".into(),
            Self::LimitExceeded(m) => format!("limit exceeded: {m}"),
            Self::Io(e) => format!("io: {e}"),
            Self::Protocol(m) => format!("protocol: {m}"),
            Self::VersionMismatch(m) => format!("version mismatch: {m}"),
            Self::NotFound(_) => "path not found".into(),
            Self::Timeout => "timeout".into(),
            Self::Other(m) => m.clone(),
        }
    }
}

#[derive(Clone, Default)]
pub struct CancelToken {
    inner: Arc<AtomicBool>,
}

impl CancelToken {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.inner.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.inner.load(Ordering::SeqCst)
    }

    pub fn check(&self) -> Result<(), ZyntheoError> {
        if self.is_cancelled() {
            Err(ZyntheoError::Cancelled)
        } else {
            Ok(())
        }
    }

    pub fn reset(&self) {
        self.inner.store(false, Ordering::SeqCst);
    }
}

/// Bounded concurrency gate for heavy sidecar operations.
#[derive(Debug)]
pub struct JobGate {
    max: usize,
    active: AtomicUsize,
}

pub struct JobPermit<'a> {
    gate: &'a JobGate,
}

impl JobGate {
    pub fn new(max: usize) -> Self {
        Self {
            max: max.max(1),
            active: AtomicUsize::new(0),
        }
    }

    pub fn active(&self) -> usize {
        self.active.load(Ordering::SeqCst)
    }

    pub fn max(&self) -> usize {
        self.max
    }

    pub fn try_enter(&self) -> Result<JobPermit<'_>, ZyntheoError> {
        loop {
            let cur = self.active.load(Ordering::SeqCst);
            if cur >= self.max {
                return Err(ZyntheoError::LimitExceeded(format!(
                    "max concurrency {}",
                    self.max
                )));
            }
            if self
                .active
                .compare_exchange(cur, cur + 1, Ordering::SeqCst, Ordering::SeqCst)
                .is_ok()
            {
                return Ok(JobPermit { gate: self });
            }
        }
    }
}

impl Drop for JobPermit<'_> {
    fn drop(&mut self) {
        self.gate.active.fetch_sub(1, Ordering::SeqCst);
    }
}

/// Best-effort RSS for the current process (bytes). Platform-specific; may be `None`.
pub fn current_rss_bytes() -> Option<u64> {
    #[cfg(target_os = "macos")]
    {
        // `ru_maxrss` is in bytes on macOS.
        unsafe {
            let mut usage: libc::rusage = std::mem::zeroed();
            if libc::getrusage(libc::RUSAGE_SELF, &mut usage) == 0 {
                return Some(usage.ru_maxrss as u64);
            }
        }
        None
    }
    #[cfg(target_os = "linux")]
    {
        // `ru_maxrss` is in kilobytes on Linux.
        unsafe {
            let mut usage: libc::rusage = std::mem::zeroed();
            if libc::getrusage(libc::RUSAGE_SELF, &mut usage) == 0 {
                return Some((usage.ru_maxrss as u64).saturating_mul(1024));
            }
        }
        None
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

/// Directory names excluded to mirror TypeScript `shouldExcludeDirectory` heuristics.
pub fn should_exclude_dir_name(name: &str) -> bool {
    if name.starts_with('.') {
        return true;
    }
    matches!(
        name,
        ".git"
            | "node_modules"
            | "dist"
            | "build"
            | "out"
            | "bin"
            | "coverage"
            | "__pycache__"
            | "env"
            | "venv"
            | "tmp"
            | "temp"
            | "artifacts"
            | "target"
            | "obj"
            | "vendor"
            | "logs"
            | "cache"
            | "resource"
            | "resources"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_token_works() {
        let t = CancelToken::new();
        assert!(t.check().is_ok());
        t.cancel();
        assert!(matches!(t.check(), Err(ZyntheoError::Cancelled)));
        t.reset();
        assert!(t.check().is_ok());
    }

    #[test]
    fn default_limits_are_bounded() {
        let l = ResourceLimits::default();
        assert!(l.max_files > 0);
        assert!(l.max_message_bytes > 0);
        assert!(l.max_concurrency >= 1);
    }

    #[test]
    fn exclude_helpers() {
        assert!(should_exclude_dir_name("node_modules"));
        assert!(should_exclude_dir_name(".hidden"));
        assert!(!should_exclude_dir_name("src"));
    }

    #[test]
    fn job_gate_bounds_concurrency() {
        let gate = JobGate::new(1);
        let p1 = gate.try_enter().unwrap();
        assert!(gate.try_enter().is_err());
        drop(p1);
        assert!(gate.try_enter().is_ok());
    }
}
