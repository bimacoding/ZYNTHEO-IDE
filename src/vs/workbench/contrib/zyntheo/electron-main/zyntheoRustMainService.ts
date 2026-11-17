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
	ZyntheoRustTreeResult,
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
}
