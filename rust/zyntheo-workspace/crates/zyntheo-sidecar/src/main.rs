//! Zyntheo sidecar: reads length-prefixed JSON requests from stdin, writes responses to stdout.

use std::io::{stdin, stdout};
use std::path::Path;
use zyntheo_core::{CancelToken, ResourceLimits, SERVICE_NAME};
use zyntheo_fs::list_tree;
use zyntheo_ipc::{read_message, write_message, Request, Response};

fn main() {
    let limits = ResourceLimits::default();
    let cancel = CancelToken::new();
    let mut input = stdin().lock();
    let mut output = stdout().lock();

    loop {
        let req: Request = match read_message(&mut input, &limits) {
            Ok(r) => r,
            Err(e) => {
                let _ = write_message(
                    &mut output,
                    &Response::Error {
                        message: e.to_string(),
                    },
                    &limits,
                );
                break;
            }
        };

        let resp = match req {
            Request::Ping => Response::Pong {
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
            Request::Cancel { id } => {
                cancel.cancel();
                Response::Cancelled { id }
            }
            Request::ListTree {
                root,
                max_depth,
                max_files,
            } => match list_tree(Path::new(&root), &limits, max_depth, max_files, &cancel) {
                Ok(tree) => Response::Tree {
                    root: tree.root.to_string_lossy().into_owned(),
                    entries: tree.entries,
                    truncated: tree.truncated,
                },
                Err(e) => Response::Error {
                    message: format!("{SERVICE_NAME}: {e}"),
                },
            },
        };

        if write_message(&mut output, &resp, &limits).is_err() {
            break;
        }
    }
}
