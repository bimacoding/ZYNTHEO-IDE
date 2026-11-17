/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	IZyntheoRustMainService,
	ZyntheoRustDiagnostic,
	ZyntheoRustIndexResult,
	ZyntheoRustFileMeta,
	ZyntheoRustResourceStats,
	ZyntheoRustSearchOptions,
	ZyntheoRustSearchResult,
	ZyntheoRustTreeResult,
	ZyntheoRustWatchPollResult,
} from '../common/zyntheoRustServiceTypes.js';
import { ZyntheoRustSidecar } from './zyntheoRustSidecar.js';

export class ZyntheoRustMainService extends Disposable implements IZyntheoRustMainService {
	declare readonly _serviceBrand: undefined;
	private readonly sidecar: ZyntheoRustSidecar;

	constructor(
		@ILogService logService: ILogService,
	) {
		super();
		this.sidecar = new ZyntheoRustSidecar(logService);
		this._register({ dispose: () => this.sidecar.dispose() });
	}

	getStatus(): Promise<ZyntheoRustDiagnostic> {
		return Promise.resolve(this.sidecar.getStatus());
	}

	listTree(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined> {
		return this.sidecar.listTree(root, maxDepth, maxFiles);
	}

	listFiles(root: string, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined> {
		return this.sidecar.listFiles(root, maxFiles);
	}

	buildIndex(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustIndexResult | undefined> {
		return this.sidecar.buildIndex(root, maxDepth, maxFiles);
	}

	refreshIndex(root: string): Promise<ZyntheoRustIndexResult | undefined> {
		return this.sidecar.refreshIndex(root);
	}

	watchStart(root: string, debounceMs?: number): Promise<string | undefined> {
		return this.sidecar.watchStart(root, debounceMs);
	}

	watchPoll(watchId: string, maxEvents?: number): Promise<ZyntheoRustWatchPollResult | undefined> {
		return this.sidecar.watchPoll(watchId, maxEvents);
	}

	watchStop(watchId: string): Promise<boolean> {
		return this.sidecar.watchStop(watchId);
	}

	search(root: string, query: string, opts?: ZyntheoRustSearchOptions): Promise<ZyntheoRustSearchResult | undefined> {
		return this.sidecar.search(root, query, opts);
	}

	statPaths(paths: string[], root?: string, maxPaths?: number): Promise<{ entries: ZyntheoRustFileMeta[]; truncated: boolean } | undefined> {
		return this.sidecar.statPaths(paths, root, maxPaths);
	}

	resourceStats(): Promise<ZyntheoRustResourceStats | undefined> {
		return this.sidecar.resourceStats();
	}
}
