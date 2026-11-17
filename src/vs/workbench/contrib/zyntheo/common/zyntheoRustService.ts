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
	ZyntheoRustTreeResult,
} from './zyntheoRustServiceTypes.js';

export const IZyntheoRustService = createDecorator<IZyntheoRustService>('zyntheoRustService');

export interface IZyntheoRustService {
	readonly _serviceBrand: undefined;
	getStatus(): Promise<ZyntheoRustDiagnostic>;
	listTree(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined>;
	listFiles(root: string, maxFiles?: number): Promise<ZyntheoRustTreeResult | undefined>;
	buildIndex(root: string, maxDepth?: number, maxFiles?: number): Promise<ZyntheoRustIndexResult | undefined>;
	refreshIndex(root: string): Promise<ZyntheoRustIndexResult | undefined>;
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
}

registerSingleton(IZyntheoRustService, ZyntheoRustService, InstantiationType.Delayed);
