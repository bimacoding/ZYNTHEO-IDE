/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { ZyntheoCheckUpdateRespose } from './zyntheoUpdateServiceTypes.js';



export interface IZyntheoUpdateService {
	readonly _serviceBrand: undefined;
	check: (explicit: boolean) => Promise<ZyntheoCheckUpdateRespose>;
}


export const IZyntheoUpdateService = createDecorator<IZyntheoUpdateService>('ZyntheoUpdateService');


// implemented by calling channel
export class ZyntheoUpdateService implements IZyntheoUpdateService {

	readonly _serviceBrand: undefined;
	private readonly zyntheoUpdateService: IZyntheoUpdateService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService, // (only usable on client side)
	) {
		// creates an IPC proxy to use metricsMainService.ts
		this.zyntheoUpdateService = ProxyChannel.toService<IZyntheoUpdateService>(mainProcessService.getChannel('zyntheo-channel-update'));
	}


	// anything transmitted over a channel must be async even if it looks like it doesn't have to be
	check: IZyntheoUpdateService['check'] = async (explicit) => {
		const res = await this.zyntheoUpdateService.check(explicit)
		return res
	}
}

registerSingleton(IZyntheoUpdateService, ZyntheoUpdateService, InstantiationType.Eager);


