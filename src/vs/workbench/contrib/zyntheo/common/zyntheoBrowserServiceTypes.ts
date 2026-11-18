/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ZyntheoBrowserBounds, ZyntheoBrowserInspectResult, ZyntheoBrowserScreenshot, ZyntheoBrowserViewState } from './zyntheoBrowser.js';

export const IZyntheoBrowserMainService = createDecorator<IZyntheoBrowserMainService>('zyntheoBrowserMainService');

export type ZyntheoBrowserNewTabRequest = {
	url: string;
	windowId: number;
};

export interface IZyntheoBrowserMainService {
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
