/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const ZYNTHEO_RUST_PROTOCOL_VERSION = 1;
export const ZYNTHEO_RUST_CHANNEL_NAME = 'zyntheo-channel-rust';

export type ZyntheoRustMode =
	| 'disabled'
	| 'enabled_healthy'
	| 'binary_missing'
	| 'startup_failed'
	| 'operation_failed'
	| 'crashed'
	| 'version_mismatch'
	| 'timeout'
	| 'adaptive_disabled';

export interface ZyntheoRustDiagnostic {
	mode: ZyntheoRustMode;
	reason?: string;
	code?: string;
	at: number;
}

export interface ZyntheoRustResourceStats {
	rss_bytes?: number;
	jobs_active: number;
	jobs_max: number;
	index_cached_roots: number;
	index_entries: number;
	watches: number;
	pid: number;
}

export interface ZyntheoRustTreeResult {
	root: string;
	entries: string[];
	truncated: boolean;
}

export interface ZyntheoRustIndexResult extends ZyntheoRustTreeResult {
	built_at_epoch_secs?: number;
	root_mtime_epoch_secs?: number;
	rebuilt?: boolean;
}

export interface ZyntheoRustWatchEvent {
	path: string;
	kind: 'any' | 'remove';
}

export interface ZyntheoRustWatchPollResult {
	events: ZyntheoRustWatchEvent[];
	truncated: boolean;
}

export interface ZyntheoRustSearchMatch {
	path: string;
	line: number;
	column: number;
	text: string;
}

export interface ZyntheoRustSearchResult {
	matches: ZyntheoRustSearchMatch[];
	files_scanned: number;
	truncated: boolean;
}

export interface ZyntheoRustFileMeta {
	path: string;
	is_dir: boolean;
	size: number;
	mtime_epoch_secs: number;
}

export interface ZyntheoRustSearchOptions {
	caseSensitive?: boolean;
	literal?: boolean;
	maxMatches?: number;
	maxFiles?: number;
	maxFileBytes?: number;
}

export interface IZyntheoRustMainService {
	readonly _serviceBrand: undefined;
	getStatus(): Promise<ZyntheoRustDiagnostic>;
	listTree(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined>;
	listFiles(root: string, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined>;
	buildIndex(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustIndexResult | undefined>;
	refreshIndex(root: string): Promise<ZyntheoRustIndexResult | undefined>;
	watchStart(root: string, debounceMs?: number): Promise<string | undefined>;
	watchPoll(watchId: string, maxEvents?: number): Promise<ZyntheoRustWatchPollResult | undefined>;
	watchStop(watchId: string): Promise<boolean>;
	search(root: string, query: string, opts?: ZyntheoRustSearchOptions): Promise<ZyntheoRustSearchResult | undefined>;
	statPaths(paths: string[], root?: string, maxPaths?: number): Promise<{ entries: ZyntheoRustFileMeta[]; truncated: boolean } | undefined>;
	resourceStats(): Promise<ZyntheoRustResourceStats | undefined>;
}

export const IZyntheoRustMainService = createDecorator<IZyntheoRustMainService>('zyntheoRustMainService');
