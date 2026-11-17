//! Zyntheo core: identity, errors, resource limits, cancellation.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;

pub const PRODUCT_NAME: &str = "Zyntheo IDE";
pub const SERVICE_NAME: &str = "zyntheo-sidecar";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_files: usize,
    pub max_depth: usize,
    pub max_message_bytes: usize,
    pub max_file_bytes: usize,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_files: 50_000,
            max_depth: 32,
            max_message_bytes: 8 * 1024 * 1024,
            max_file_bytes: 2 * 1024 * 1024,
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
    #[error("other: {0}")]
    Other(String),
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
    }

    #[test]
    fn default_limits_are_bounded() {
        let l = ResourceLimits::default();
        assert!(l.max_files > 0);
        assert!(l.max_message_bytes > 0);
    }
}
