/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import {
	IZyntheoRustMainService,
	ZYNTHEO_RUST_CHANNEL_NAME,
	ZyntheoRustDiagnostic,
	ZyntheoRustIndexResult,
	ZyntheoRustFileMeta,
	ZyntheoRustResourceStats,
	ZyntheoRustSearchOptions,
	ZyntheoRustSearchResult,
	ZyntheoRustTreeResult,
	ZyntheoRustWatchPollResult,
} from './zyntheoRustServiceTypes.js';

export const IZyntheoRustService = createDecorator<IZyntheoRustService>('zyntheoRustService');

export interface IZyntheoRustService {
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

class ZyntheoRustService implements IZyntheoRustService {
	declare readonly _serviceBrand: undefined;
	private readonly remote: IZyntheoRustMainService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		this.remote = ProxyChannel.toService<IZyntheoRustMainService>(
			mainProcessService.getChannel(ZYNTHEO_RUST_CHANNEL_NAME),
		);
	}

	getStatus(): Promise<ZyntheoRustDiagnostic> {
		return this.remote.getStatus();
	}

	listTree(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined> {
		return this.remote.listTree(root, maxDepth, maxFiles);
	}

	listFiles(root: string, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined> {
		return this.remote.listFiles(root, maxFiles);
	}

	buildIndex(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustIndexResult | undefined> {
		return this.remote.buildIndex(root, maxDepth, maxFiles);
	}

	refreshIndex(root: string): Promise<ZyntheoRustIndexResult | undefined> {
		return this.remote.refreshIndex(root);
	}

	watchStart(root: string, debounceMs?: number): Promise<string | undefined> {
		return this.remote.watchStart(root, debounceMs);
	}

	watchPoll(watchId: string, maxEvents?: number): Promise<ZyntheoRustWatchPollResult | undefined> {
		return this.remote.watchPoll(watchId, maxEvents);
	}

	watchStop(watchId: string): Promise<boolean> {
		return this.remote.watchStop(watchId);
	}

	search(root: string, query: string, opts?: ZyntheoRustSearchOptions): Promise<ZyntheoRustSearchResult | undefined> {
		return this.remote.search(root, query, opts);
	}

	statPaths(paths: string[], root?: string, maxPaths?: number): Promise<{ entries: ZyntheoRustFileMeta[]; truncated: boolean } | undefined> {
		return this.remote.statPaths(paths, root, maxPaths);
	}

	resourceStats(): Promise<ZyntheoRustResourceStats | undefined> {
		return this.remote.resourceStats();
	}
}

registerSingleton(IZyntheoRustService, ZyntheoRustService, InstantiationType.Delayed);
