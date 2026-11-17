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
	| 'timeout';

export interface ZyntheoRustDiagnostic {
	mode: ZyntheoRustMode;
	reason?: string;
	code?: string;
	at: number;
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

export interface IZyntheoRustMainService {
	readonly _serviceBrand: undefined;
	getStatus(): Promise<ZyntheoRustDiagnostic>;
	listTree(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined>;
	listFiles(root: string, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined>;
	buildIndex(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustIndexResult | undefined>;
	refreshIndex(root: string): Promise<ZyntheoRustIndexResult | undefined>;
}

export const IZyntheoRustMainService = createDecorator<IZyntheoRustMainService>('zyntheoRustMainService');
