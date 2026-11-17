//! Length-prefixed JSON IPC (4-byte big-endian length + UTF-8 JSON body).
//!
//! Framing choice: length-prefix (not bare JSON Lines) so we can enforce
//! `max_message_bytes` before allocating/parsing the body.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Read, Write};
use zyntheo_core::{ErrorCode, ResourceLimits, PROTOCOL_VERSION, ZyntheoError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestEnvelope {
    pub protocol_version: u32,
    pub id: String,
    pub op: String,
    #[serde(default)]
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseEnvelope {
    pub protocol_version: u32,
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorBody>,
}

impl ResponseEnvelope {
    pub fn ok(id: impl Into<String>, result: Value) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            id: id.into(),
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    pub fn err(id: impl Into<String>, code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            id: id.into(),
            ok: false,
            result: None,
            error: Some(ErrorBody {
                code: code.as_str().to_string(),
                message: message.into(),
            }),
        }
    }

    pub fn from_zyntheo(id: impl Into<String>, err: &ZyntheoError) -> Self {
        Self::err(id, err.code(), err.safe_message())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTreePayload {
    pub root: String,
    pub max_depth: Option<usize>,
    pub max_files: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildIndexPayload {
    pub root: String,
    pub max_depth: Option<usize>,
    pub max_files: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancelPayload {
    pub target_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeResultJson {
    pub root: String,
    pub entries: Vec<String>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResult {
    pub service: String,
    pub api_version: String,
    pub protocol_version: u32,
    pub pid: u32,
}

pub fn encode_message<T: Serialize>(value: &T, limits: &ResourceLimits) -> Result<Vec<u8>, ZyntheoError> {
    let body = serde_json::to_vec(value).map_err(|e| ZyntheoError::Protocol(e.to_string()))?;
    if body.len() > limits.max_message_bytes {
        return Err(ZyntheoError::LimitExceeded(format!(
            "message {} bytes exceeds max {}",
            body.len(),
            limits.max_message_bytes
        )));
    }
    let mut out = Vec::with_capacity(4 + body.len());
    out.extend_from_slice(&(body.len() as u32).to_be_bytes());
    out.extend_from_slice(&body);
    Ok(out)
}

pub fn write_message<W: Write, T: Serialize>(
    writer: &mut W,
    value: &T,
    limits: &ResourceLimits,
) -> Result<(), ZyntheoError> {
    let bytes = encode_message(value, limits)?;
    writer.write_all(&bytes)?;
    writer.flush()?;
    Ok(())
}

pub fn read_message<R: Read, T: for<'de> Deserialize<'de>>(
    reader: &mut R,
    limits: &ResourceLimits,
) -> Result<T, ZyntheoError> {
    let mut len_buf = [0u8; 4];
    reader.read_exact(&mut len_buf)?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len > limits.max_message_bytes {
        return Err(ZyntheoError::LimitExceeded(format!(
            "incoming message {len} exceeds max {}",
            limits.max_message_bytes
        )));
    }
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body)?;
    serde_json::from_slice(&body).map_err(|e| ZyntheoError::Protocol(e.to_string()))
}

pub fn check_protocol_version(version: u32) -> Result<(), ZyntheoError> {
    if version != PROTOCOL_VERSION {
        Err(ZyntheoError::VersionMismatch(format!(
            "got {version}, expected {PROTOCOL_VERSION}"
        )))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn roundtrip_envelope() {
        let limits = ResourceLimits::default();
        let req = RequestEnvelope {
            protocol_version: PROTOCOL_VERSION,
            id: "1".into(),
            op: "ping".into(),
            payload: Value::Null,
        };
        let mut buf = Vec::new();
        write_message(&mut buf, &req, &limits).unwrap();
        let mut cur = Cursor::new(buf);
        let got: RequestEnvelope = read_message(&mut cur, &limits).unwrap();
        assert_eq!(got.op, "ping");
        assert_eq!(got.id, "1");
    }

    #[test]
    fn rejects_oversized_length() {
        let limits = ResourceLimits {
            max_message_bytes: 16,
            ..ResourceLimits::default()
        };
        let mut raw = Vec::new();
        raw.extend_from_slice(&100u32.to_be_bytes());
        raw.extend_from_slice(&[0u8; 8]);
        let mut cur = Cursor::new(raw);
        let err: Result<RequestEnvelope, _> = read_message(&mut cur, &limits);
        assert!(matches!(err, Err(ZyntheoError::LimitExceeded(_))));
    }

    #[test]
    fn version_check() {
        assert!(check_protocol_version(PROTOCOL_VERSION).is_ok());
        assert!(check_protocol_version(999).is_err());
    }
}
