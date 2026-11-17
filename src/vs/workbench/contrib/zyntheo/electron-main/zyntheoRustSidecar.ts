/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { join } from 'path';
import { ILogService } from '../../../../platform/log/common/log.js';

/**
 * Feature-flagged Rust sidecar bridge.
 * Default: disabled — callers must fall back to TypeScript directoryStrService.
 *
 * Enable with env ZYNTHEO_RUST_SERVICES=1 or when a built binary is present and opted-in.
 */
export class ZyntheoRustSidecar {
	private proc: ChildProcessWithoutNullStreams | undefined;
	private buffer = Buffer.alloc(0);

	constructor(
		private readonly logService: ILogService,
		private readonly enabled: boolean = process.env['ZYNTHEO_RUST_SERVICES'] === '1',
	) { }

	get isEnabled(): boolean {
		return this.enabled;
	}

	async listTree(root: string, maxDepth?: number, maxFiles?: number): Promise<{ entries: string[]; truncated: boolean } | undefined> {
		if (!this.enabled) {
			return undefined;
		}
		try {
			await this.ensureStarted();
			const response = await this.request({
				op: 'list_tree',
				root,
				max_depth: maxDepth,
				max_files: maxFiles,
			});
			if (response?.type === 'tree') {
				return { entries: response.entries as string[], truncated: !!response.truncated };
			}
			this.logService.warn('[zyntheo-rust] listTree failed', response);
			return undefined;
		} catch (e) {
			this.logService.warn('[zyntheo-rust] listTree error; use TS fallback', e);
			return undefined;
		}
	}

	dispose(): void {
		try {
			this.proc?.kill();
		} catch {
			// ignore
		}
		this.proc = undefined;
	}

	private async ensureStarted(): Promise<void> {
		if (this.proc && !this.proc.killed) {
			return;
		}
		const binary = process.env['ZYNTHEO_SIDECAR_PATH']
			|| join(process.cwd(), 'rust', 'zyntheo-workspace', 'target', 'release', 'zyntheo-sidecar');
		this.proc = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
		this.proc.stderr.on('data', (d: Buffer) => {
			this.logService.trace('[zyntheo-sidecar]', d.toString());
		});
		this.proc.on('exit', (code) => {
			this.logService.info('[zyntheo-sidecar] exited', code);
			this.proc = undefined;
		});
	}

	private request(payload: object): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.proc) {
				reject(new Error('sidecar not started'));
				return;
			}
			const body = Buffer.from(JSON.stringify(payload), 'utf8');
			const header = Buffer.alloc(4);
			header.writeUInt32BE(body.length, 0);
			const onData = (chunk: Buffer) => {
				this.buffer = Buffer.concat([this.buffer, chunk]);
				if (this.buffer.length < 4) {
					return;
				}
				const len = this.buffer.readUInt32BE(0);
				if (this.buffer.length < 4 + len) {
					return;
				}
				const json = this.buffer.subarray(4, 4 + len).toString('utf8');
				this.buffer = this.buffer.subarray(4 + len);
				this.proc?.stdout.off('data', onData);
				try {
					resolve(JSON.parse(json));
				} catch (e) {
					reject(e);
				}
			};
			this.proc.stdout.on('data', onData);
			this.proc.stdin.write(Buffer.concat([header, body]));
		});
	}
}
