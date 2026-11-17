//! Length-prefixed JSON IPC (4-byte big-endian length + UTF-8 JSON body).

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use zyntheo_core::{ResourceLimits, ZyntheoError};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Request {
    Ping,
    ListTree {
        root: String,
        max_depth: Option<usize>,
        max_files: Option<usize>,
    },
    Cancel {
        id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Response {
    Pong { version: String },
    Tree { root: String, entries: Vec<String>, truncated: bool },
    Error { message: String },
    Cancelled { id: String },
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn roundtrip_ping() {
        let limits = ResourceLimits::default();
        let mut buf = Vec::new();
        write_message(&mut buf, &Request::Ping, &limits).unwrap();
        let mut cur = Cursor::new(buf);
        let req: Request = read_message(&mut cur, &limits).unwrap();
        assert!(matches!(req, Request::Ping));
    }
}
