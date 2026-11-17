/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	ZYNTHEO_RUST_PROTOCOL_VERSION,
	ZyntheoRustDiagnostic,
	ZyntheoRustIndexResult,
	ZyntheoRustMode,
	ZyntheoRustTreeResult,
	ZyntheoRustFileMeta,
	ZyntheoRustResourceStats,
	ZyntheoRustSearchOptions,
	ZyntheoRustSearchResult,
	ZyntheoRustWatchEvent,
	ZyntheoRustWatchPollResult,
} from '../common/zyntheoRustServiceTypes.js';

interface Pending {
	resolve: (value: any) => void;
	reject: (err: Error) => void;
	timer: NodeJS.Timeout;
}

/**
 * Feature-flagged Rust sidecar bridge (stdio, length-prefixed JSON envelopes).
 *
 * Enable: ZYNTHEO_RUST_SERVICES=1
 * Binary: ZYNTHEO_SIDECAR_PATH or rust/zyntheo-workspace/target/release/zyntheo-sidecar
 *
 * On any failure mode, methods return `undefined` so callers keep TypeScript fallback.
 * Diagnostics are recorded (no file contents / secrets).
 */
export class ZyntheoRustSidecar {
	private proc: ChildProcessWithoutNullStreams | undefined;
	private buffer = Buffer.alloc(0);
	private nextId = 1;
	private readonly pending = new Map<string, Pending>();
	private mode: ZyntheoRustMode;
	private lastReason: string | undefined;
	private lastCode: string | undefined;
	private restartCount = 0;
	private permanentlyDisabled = false;
	private readonly maxRestarts = 3;
	private readonly requestTimeoutMs: number;
	/** Soft-disable Rust when sidecar RSS exceeds this (bytes). 0 = off. */
	private readonly maxRssBytes: number;
	private readonly maxLimitExceededStreak = 3;
	private limitExceededStreak = 0;
	private opsSinceResourceCheck = 0;
	private readonly resourceCheckEvery = 8;

	constructor(
		private readonly logService: ILogService,
		private readonly enabledByEnv: boolean = process.env['ZYNTHEO_RUST_SERVICES'] === '1',
		requestTimeoutMs?: number,
	) {
		this.requestTimeoutMs = requestTimeoutMs
			?? (Number(process.env['ZYNTHEO_RUST_TIMEOUT_MS']) || 30_000);
		this.maxRssBytes = Number(process.env['ZYNTHEO_RUST_MAX_RSS_BYTES']) || 0;
		this.mode = this.enabledByEnv ? 'enabled_healthy' : 'disabled';
	}

	getStatus(): ZyntheoRustDiagnostic {
		return {
			mode: this.permanentlyDisabled && this.mode !== 'disabled' ? this.mode : this.mode,
			reason: this.lastReason,
			code: this.lastCode,
			at: Date.now(),
		};
	}

	get isEnabled(): boolean {
		return this.enabledByEnv && !this.permanentlyDisabled && this.mode !== 'disabled';
	}

	async listTree(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined> {
		return this.callTree('list_tree', { root, max_depth: maxDepth, max_files: maxFiles });
	}

	async listFiles(root: string, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined> {
		return this.callTree('list_files', { root, max_files: maxFiles });
	}

	async buildIndex(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustIndexResult | undefined> {
		return this.callIndex('build_index', { root, max_depth: maxDepth, max_files: maxFiles });
	}

	async refreshIndex(root: string): Promise<ZyntheoRustIndexResult | undefined> {
		return this.callIndex('refresh_index', { root });
	}

	async watchStart(root: string, debounceMs?: number): Promise<string | undefined> {
		const result = await this.invoke('watch_start', { root, debounce_ms: debounceMs });
		return result?.watch_id ? String(result.watch_id) : undefined;
	}

	async watchPoll(watchId: string, maxEvents?: number): Promise<ZyntheoRustWatchPollResult | undefined> {
		const result = await this.invoke('watch_poll', { watch_id: watchId, max_events: maxEvents });
		if (!result) {
			return undefined;
		}
		const events: ZyntheoRustWatchEvent[] = Array.isArray(result.events)
			? result.events.map((e: any) => ({
				path: String(e.path ?? ''),
				kind: e.kind === 'remove' ? 'remove' : 'any',
			}))
			: [];
		return { events, truncated: !!result.truncated };
	}

	async watchStop(watchId: string): Promise<boolean> {
		const result = await this.invoke('watch_stop', { watch_id: watchId });
		return !!result;
	}

	async search(root: string, query: string, opts?: ZyntheoRustSearchOptions): Promise<ZyntheoRustSearchResult | undefined> {
		const result = await this.invoke('search', {
			root,
			query,
			case_sensitive: opts?.caseSensitive,
			literal: opts?.literal ?? true,
			max_matches: opts?.maxMatches,
			max_files: opts?.maxFiles,
			max_file_bytes: opts?.maxFileBytes,
		});
		if (!result) {
			return undefined;
		}
		return {
			matches: Array.isArray(result.matches)
				? result.matches.map((m: any) => ({
					path: String(m.path ?? ''),
					line: Number(m.line ?? 0),
					column: Number(m.column ?? 0),
					text: String(m.text ?? ''),
				}))
				: [],
			files_scanned: Number(result.files_scanned ?? 0),
			truncated: !!result.truncated,
		};
	}

	async statPaths(paths: string[], root?: string, maxPaths?: number): Promise<{ entries: ZyntheoRustFileMeta[]; truncated: boolean } | undefined> {
		const result = await this.invoke('stat_paths', { root, paths, max_paths: maxPaths });
		if (!result) {
			return undefined;
		}
		const entries: ZyntheoRustFileMeta[] = Array.isArray(result.entries)
			? result.entries.map((e: any) => ({
				path: String(e.path ?? ''),
				is_dir: !!e.is_dir,
				size: Number(e.size ?? 0),
				mtime_epoch_secs: Number(e.mtime_epoch_secs ?? 0),
			}))
			: [];
		return { entries, truncated: !!result.truncated };
	}

	async resourceStats(): Promise<ZyntheoRustResourceStats | undefined> {
		const result = await this.invoke('resource_stats', {});
		if (!result) {
			return undefined;
		}
		return {
			rss_bytes: result.rss_bytes != null ? Number(result.rss_bytes) : undefined,
			jobs_active: Number(result.jobs_active ?? 0),
			jobs_max: Number(result.jobs_max ?? 0),
			index_cached_roots: Number(result.index_cached_roots ?? 0),
			index_entries: Number(result.index_entries ?? 0),
			watches: Number(result.watches ?? 0),
			pid: Number(result.pid ?? 0),
		};
	}

	dispose(): void {
		this.shutdownBestEffort();
		this.rejectAll(new Error('sidecar disposed'));
		try {
			this.proc?.kill();
		} catch {
			// ignore
		}
		this.proc = undefined;
	}

	private async callTree(op: string, payload: object): Promise<ZyntheoRustTreeResult | undefined> {
		const result = await this.invoke(op, payload);
		if (!result) {
			return undefined;
		}
		return {
			root: String(result.root ?? ''),
			entries: Array.isArray(result.entries) ? result.entries.map(String) : [],
			truncated: !!result.truncated,
		};
	}

	private async callIndex(op: string, payload: object): Promise<ZyntheoRustIndexResult | undefined> {
		const result = await this.invoke(op, payload);
		if (!result) {
			return undefined;
		}
		return {
			root: String(result.root ?? ''),
			entries: Array.isArray(result.entries) ? result.entries.map(String) : [],
			truncated: !!result.truncated,
			built_at_epoch_secs: result.built_at_epoch_secs,
			root_mtime_epoch_secs: result.root_mtime_epoch_secs,
			rebuilt: result.rebuilt,
		};
	}

	private async invoke(op: string, payload: object): Promise<any | undefined> {
		if (!this.enabledByEnv || this.permanentlyDisabled) {
			if (this.mode !== 'adaptive_disabled') {
				this.setMode('disabled', 'rust services disabled');
			}
			return undefined;
		}
		try {
			await this.ensureStarted();
			const response = await this.request(op, payload);
			if (!response?.ok) {
				const code = response?.error?.code as string | undefined;
				const message = response?.error?.message as string | undefined;
				if (code === 'VERSION_MISMATCH') {
					this.permanentlyDisabled = true;
					this.setMode('version_mismatch', message ?? 'protocol mismatch', code);
					this.disposeProcess();
					return undefined;
				}
				if (code === 'LIMIT_EXCEEDED') {
					this.limitExceededStreak += 1;
					if (this.limitExceededStreak >= this.maxLimitExceededStreak) {
						this.adaptivelyDisable(`repeated LIMIT_EXCEEDED (${this.limitExceededStreak})`);
						return undefined;
					}
				} else {
					this.limitExceededStreak = 0;
				}
				this.setMode('operation_failed', message ?? 'operation failed', code);
				this.logService.warn('[zyntheo-rust] op failed', op, code, message);
				return undefined;
			}
			this.limitExceededStreak = 0;
			this.setMode('enabled_healthy');
			if (op !== 'resource_stats') {
				await this.maybeCheckResources();
			}
			return response.result;
		} catch (e: any) {
			const msg = e?.message ? String(e.message) : String(e);
			if (msg.includes('timeout')) {
				this.setMode('timeout', msg, 'TIMEOUT');
			} else if (msg.includes('ENOENT') || msg.includes('binary missing')) {
				this.setMode('binary_missing', msg, 'UNAVAILABLE');
				this.permanentlyDisabled = true;
			} else if (msg.includes('spawn') || msg.includes('startup')) {
				this.setMode('startup_failed', msg, 'UNAVAILABLE');
			} else {
				this.setMode('operation_failed', msg);
			}
			this.logService.warn('[zyntheo-rust] invoke error; TS fallback', op, msg);
			this.disposeProcess();
			return undefined;
		}
	}

	private adaptivelyDisable(reason: string): void {
		this.permanentlyDisabled = true;
		this.setMode('adaptive_disabled', reason, 'LIMIT_EXCEEDED');
		this.logService.warn('[zyntheo-rust] adaptive disable; TS fallback', reason);
		this.disposeProcess();
	}

	private async maybeCheckResources(): Promise<void> {
		if (this.maxRssBytes <= 0 || this.permanentlyDisabled) {
			return;
		}
		this.opsSinceResourceCheck += 1;
		if (this.opsSinceResourceCheck < this.resourceCheckEvery) {
			return;
		}
		this.opsSinceResourceCheck = 0;
		try {
			const response = await this.request('resource_stats', {});
			const rss = response?.ok ? Number(response.result?.rss_bytes ?? 0) : 0;
			if (rss > 0 && rss > this.maxRssBytes) {
				this.adaptivelyDisable(`sidecar RSS ${rss} > ${this.maxRssBytes}`);
			}
		} catch {
			// ignore sampling failures
		}
	}

	private setMode(mode: ZyntheoRustMode, reason?: string, code?: string): void {
		this.mode = mode;
		this.lastReason = reason;
		this.lastCode = code;
	}

	private resolveBinary(): string {
		const exe = process.platform === 'win32' ? 'zyntheo-sidecar.exe' : 'zyntheo-sidecar';
		let appPath: string | undefined;
		try {
			// electron-main only
			appPath = require('electron').app?.getAppPath?.();
		} catch {
			appPath = undefined;
		}
		const candidates = [
			process.env['ZYNTHEO_SIDECAR_PATH'],
			appPath ? join(appPath, 'resources', 'helpers', exe) : undefined,
			// Packaged helper next to Electron binary / resources
			join(dirname(process.execPath), exe),
			join(dirname(process.execPath), 'resources', 'helpers', exe),
			join(dirname(process.execPath), 'helpers', exe),
			join(dirname(process.execPath), '..', 'Resources', 'app', 'resources', 'helpers', exe),
			// Dev / staged helpers
			join(process.cwd(), 'resources', 'helpers', exe),
			join(process.cwd(), 'rust', 'zyntheo-workspace', 'target', 'release', exe),
			join(process.cwd(), '.build', 'zyntheo-sidecar', exe),
		].filter((p): p is string => !!p);
		for (const p of candidates) {
			if (existsSync(p)) {
				return p;
			}
		}
		return candidates[candidates.length - 1]!;
	}

	private async ensureStarted(): Promise<void> {
		if (this.proc && !this.proc.killed) {
			return;
		}
		if (this.restartCount > this.maxRestarts) {
			this.permanentlyDisabled = true;
			throw new Error('startup: restart budget exhausted');
		}
		const binary = this.resolveBinary();
		if (!existsSync(binary)) {
			this.permanentlyDisabled = true;
			throw new Error(`binary missing: ${binary}`);
		}
		this.restartCount += 1;
		this.buffer = Buffer.alloc(0);
		this.proc = spawn(binary, [], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env },
		});
		this.proc.stderr.on('data', (d: Buffer) => {
			// stderr only — never treat as protocol
			this.logService.trace('[zyntheo-sidecar]', d.toString().trim());
		});
		this.proc.stdout.on('data', (chunk: Buffer) => this.onStdout(chunk));
		this.proc.on('exit', (code) => {
			this.logService.info('[zyntheo-sidecar] exited', code);
			this.proc = undefined;
			this.setMode('crashed', `exit code ${code}`, 'UNAVAILABLE');
			this.rejectAll(new Error(`sidecar crashed (${code})`));
		});
		this.proc.on('error', (err) => {
			this.logService.warn('[zyntheo-sidecar] process error', err);
			this.setMode('startup_failed', String(err), 'UNAVAILABLE');
		});

		// Health handshake
		const health = await this.request('health', {});
		if (!health?.ok || health?.result?.protocol_version !== ZYNTHEO_RUST_PROTOCOL_VERSION) {
			this.permanentlyDisabled = true;
			this.setMode('version_mismatch', 'health/protocol failed', 'VERSION_MISMATCH');
			this.disposeProcess();
			throw new Error('startup: health/protocol failed');
		}
		this.setMode('enabled_healthy');
		this.restartCount = Math.max(0, this.restartCount - 1); // successful start refunds one
	}

	private onStdout(chunk: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		while (this.buffer.length >= 4) {
			const len = this.buffer.readUInt32BE(0);
			if (len > 8 * 1024 * 1024) {
				this.logService.warn('[zyntheo-rust] oversized frame; dropping process');
				this.disposeProcess();
				this.rejectAll(new Error('oversized frame'));
				return;
			}
			if (this.buffer.length < 4 + len) {
				return;
			}
			const json = this.buffer.subarray(4, 4 + len).toString('utf8');
			this.buffer = this.buffer.subarray(4 + len);
			try {
				const msg = JSON.parse(json);
				const id = String(msg.id ?? '');
				const pending = this.pending.get(id);
				if (pending) {
					clearTimeout(pending.timer);
					this.pending.delete(id);
					pending.resolve(msg);
				}
			} catch (e) {
				this.logService.warn('[zyntheo-rust] malformed JSON frame', e);
			}
		}
	}

	private request(op: string, payload: object): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.proc || this.proc.killed) {
				reject(new Error('sidecar not started'));
				return;
			}
			const id = String(this.nextId++);
			const envelope = {
				protocol_version: ZYNTHEO_RUST_PROTOCOL_VERSION,
				id,
				op,
				payload,
			};
			const body = Buffer.from(JSON.stringify(envelope), 'utf8');
			const header = Buffer.alloc(4);
			header.writeUInt32BE(body.length, 0);
			const timer = setTimeout(() => {
				this.pending.delete(id);
				// best-effort cancel
				try {
					this.writeRaw({
						protocol_version: ZYNTHEO_RUST_PROTOCOL_VERSION,
						id: String(this.nextId++),
						op: 'cancel',
						payload: { target_id: id },
					});
				} catch {
					// ignore
				}
				reject(new Error(`timeout after ${this.requestTimeoutMs}ms`));
			}, this.requestTimeoutMs);
			this.pending.set(id, { resolve, reject, timer });
			try {
				this.proc.stdin.write(Buffer.concat([header, body]));
			} catch (e) {
				clearTimeout(timer);
				this.pending.delete(id);
				reject(e instanceof Error ? e : new Error(String(e)));
			}
		});
	}

	private writeRaw(envelope: object): void {
		if (!this.proc) {
			return;
		}
		const body = Buffer.from(JSON.stringify(envelope), 'utf8');
		const header = Buffer.alloc(4);
		header.writeUInt32BE(body.length, 0);
		this.proc.stdin.write(Buffer.concat([header, body]));
	}

	private shutdownBestEffort(): void {
		try {
			if (this.proc && !this.proc.killed) {
				this.writeRaw({
					protocol_version: ZYNTHEO_RUST_PROTOCOL_VERSION,
					id: String(this.nextId++),
					op: 'shutdown',
					payload: {},
				});
			}
		} catch {
			// ignore
		}
	}

	private disposeProcess(): void {
		try {
			this.proc?.kill();
		} catch {
			// ignore
		}
		this.proc = undefined;
	}

	private rejectAll(err: Error): void {
		for (const [, p] of this.pending) {
			clearTimeout(p.timer);
			p.reject(err);
		}
		this.pending.clear();
	}
}
