/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import {
	ZYNTHEO_BROWSER_CHANNEL_NAME,
	ZyntheoBrowserBounds,
	ZyntheoBrowserInspectResult,
	ZyntheoBrowserScreenshot,
	ZyntheoBrowserViewState,
} from './zyntheoBrowser.js';
import { IZyntheoBrowserMainService, ZyntheoBrowserNewTabRequest } from './zyntheoBrowserServiceTypes.js';

export const IZyntheoBrowserService = createDecorator<IZyntheoBrowserService>('zyntheoBrowserService');

export interface IZyntheoBrowserService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeState: Event<ZyntheoBrowserViewState>;
	readonly onDidRequestNewTab: Event<ZyntheoBrowserNewTabRequest>;
	readonly onDidInspectElement: Event<ZyntheoBrowserInspectResult>;
	createView(viewId: string, windowId: number, url: string): Promise<ZyntheoBrowserViewState>;
	destroyView(viewId: string): Promise<void>;
	showView(viewId: string, bounds: ZyntheoBrowserBounds, windowId: number): Promise<void>;
	hideView(viewId: string): Promise<void>;
	navigate(viewId: string, url: string): Promise<void>;
	goBack(viewId: string): Promise<void>;
	goForward(viewId: string): Promise<void>;
	reload(viewId: string, hard?: boolean): Promise<void>;
	setZoom(viewId: string, factor: number): Promise<number>;
	openDevTools(viewId: string): Promise<void>;
	toggleInspect(viewId: string, enabled: boolean): Promise<boolean>;
	captureScreenshot(viewId: string): Promise<ZyntheoBrowserScreenshot | undefined>;
	getCurrentUrl(viewId: string): Promise<string | undefined>;
	clearCache(viewId: string): Promise<void>;
	clearCookies(viewId: string): Promise<void>;
	clearHistory(viewId: string): Promise<void>;
	getState(viewId: string): Promise<ZyntheoBrowserViewState | undefined>;
}

class ZyntheoBrowserService implements IZyntheoBrowserService {
	declare readonly _serviceBrand: undefined;
	private readonly remote: IZyntheoBrowserMainService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		this.remote = ProxyChannel.toService<IZyntheoBrowserMainService>(
			mainProcessService.getChannel(ZYNTHEO_BROWSER_CHANNEL_NAME),
		);
	}

	get onDidChangeState(): Event<ZyntheoBrowserViewState> {
		return this.remote.onDidChangeState;
	}

	get onDidRequestNewTab(): Event<ZyntheoBrowserNewTabRequest> {
		return this.remote.onDidRequestNewTab;
	}

	get onDidInspectElement(): Event<ZyntheoBrowserInspectResult> {
		return this.remote.onDidInspectElement;
	}

	createView(viewId: string, windowId: number, url: string): Promise<ZyntheoBrowserViewState> {
		return this.remote.createView(viewId, windowId, url);
	}

	destroyView(viewId: string): Promise<void> {
		return this.remote.destroyView(viewId);
	}

	showView(viewId: string, bounds: ZyntheoBrowserBounds, windowId: number): Promise<void> {
		return this.remote.showView(viewId, bounds, windowId);
	}

	hideView(viewId: string): Promise<void> {
		return this.remote.hideView(viewId);
	}

	navigate(viewId: string, url: string): Promise<void> {
		return this.remote.navigate(viewId, url);
	}

	goBack(viewId: string): Promise<void> {
		return this.remote.goBack(viewId);
	}

	goForward(viewId: string): Promise<void> {
		return this.remote.goForward(viewId);
	}

	reload(viewId: string, hard?: boolean): Promise<void> {
		return this.remote.reload(viewId, hard);
	}

	setZoom(viewId: string, factor: number): Promise<number> {
		return this.remote.setZoom(viewId, factor);
	}

	openDevTools(viewId: string): Promise<void> {
		return this.remote.openDevTools(viewId);
	}

	toggleInspect(viewId: string, enabled: boolean): Promise<boolean> {
		return this.remote.toggleInspect(viewId, enabled);
	}

	captureScreenshot(viewId: string): Promise<ZyntheoBrowserScreenshot | undefined> {
		return this.remote.captureScreenshot(viewId);
	}

	getCurrentUrl(viewId: string): Promise<string | undefined> {
		return this.remote.getCurrentUrl(viewId);
	}

	clearCache(viewId: string): Promise<void> {
		return this.remote.clearCache(viewId);
	}

	clearCookies(viewId: string): Promise<void> {
		return this.remote.clearCookies(viewId);
	}

	clearHistory(viewId: string): Promise<void> {
		return this.remote.clearHistory(viewId);
	}

	getState(viewId: string): Promise<ZyntheoBrowserViewState | undefined> {
		return this.remote.getState(viewId);
	}
}

registerSingleton(IZyntheoBrowserService, ZyntheoBrowserService, InstantiationType.Delayed);
