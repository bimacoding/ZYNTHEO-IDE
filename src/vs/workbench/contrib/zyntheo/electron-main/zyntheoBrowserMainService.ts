/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BrowserView, BrowserWindow, session } from 'electron';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWindowsMainService } from '../../../../platform/windows/electron-main/windows.js';
import {
	clampBrowserBounds,
	emptyBrowserState,
	normalizeBrowserUrl,
	titleFromUrl,
	ZyntheoBrowserBounds,
	ZyntheoBrowserInspectResult,
	ZyntheoBrowserScreenshot,
	ZyntheoBrowserViewState,
} from '../common/zyntheoBrowser.js';
import { IZyntheoBrowserMainService, ZyntheoBrowserNewTabRequest } from '../common/zyntheoBrowserServiceTypes.js';

type ManagedView = {
	view: BrowserView;
	windowId: number;
	state: ZyntheoBrowserViewState;
	inspecting: boolean;
	visible: boolean;
	debuggerBound: boolean;
};

const PARTITION = 'persist:zyntheo-browser';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 ZyntheoBrowser/1.0';

const INSPECT_SCRIPT = `function () {
	function cssPath(el) {
		if (!(el instanceof Element)) {
			return '';
		}
		const parts = [];
		let node = el;
		while (node && node.nodeType === 1 && parts.length < 6) {
			let selector = node.nodeName.toLowerCase();
			if (node.id) {
				selector += '#' + CSS.escape(node.id);
				parts.unshift(selector);
				break;
			}
			const className = typeof node.className === 'string' ? node.className.trim() : '';
			if (className) {
				selector += '.' + className.split(/\\s+/).slice(0, 2).map(c => CSS.escape(c)).join('.');
			}
			const parent = node.parentElement;
			if (parent) {
				const siblings = Array.from(parent.children).filter(child => child.nodeName === node.nodeName);
				if (siblings.length > 1) {
					selector += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
				}
			}
			parts.unshift(selector);
			node = parent;
		}
		return parts.join(' > ');
	}
	const style = this instanceof Element ? getComputedStyle(this) : undefined;
	const pick = (name) => style ? style.getPropertyValue(name) : '';
	return {
		tagName: this && this.tagName ? this.tagName.toLowerCase() : 'node',
		selector: cssPath(this),
		outerHTML: (this && this.outerHTML ? this.outerHTML : '').slice(0, 8000),
		innerText: (this && this.innerText ? this.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 1500),
		computedStyle: {
			display: pick('display'),
			position: pick('position'),
			width: pick('width'),
			height: pick('height'),
			color: pick('color'),
			background: pick('background-color'),
			font: pick('font'),
		},
	};
}`;

export class ZyntheoBrowserMainService extends Disposable implements IZyntheoBrowserMainService {
	declare readonly _serviceBrand: undefined;

	private readonly views = new Map<string, ManagedView>();
	private readonly _onDidChangeState = this._register(new Emitter<ZyntheoBrowserViewState>());
	readonly onDidChangeState = this._onDidChangeState.event;
	private readonly _onDidRequestNewTab = this._register(new Emitter<ZyntheoBrowserNewTabRequest>());
	readonly onDidRequestNewTab = this._onDidRequestNewTab.event;
	private readonly _onDidInspectElement = this._register(new Emitter<ZyntheoBrowserInspectResult>());
	readonly onDidInspectElement = this._onDidInspectElement.event;

	constructor(
		@IWindowsMainService private readonly windowsMainService: IWindowsMainService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async createView(viewId: string, windowId: number, url: string): Promise<ZyntheoBrowserViewState> {
		this.destroyManaged(viewId);
		const win = this.getBrowserWindow(windowId);
		if (!win) {
			throw new Error('Zyntheo Browser: parent window not found');
		}

		const normalized = normalizeBrowserUrl(url);
		const view = new BrowserView({
			webPreferences: {
				sandbox: true,
				contextIsolation: true,
				nodeIntegration: false,
				javascript: true,
				webviewTag: false,
				partition: PARTITION,
				spellcheck: true,
			},
		});
		view.setAutoResize({ width: false, height: false });
		view.webContents.setUserAgent(USER_AGENT);
		view.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
			this._onDidRequestNewTab.fire({ url: nextUrl, windowId });
			return { action: 'deny' };
		});

		const managed: ManagedView = {
			view,
			windowId,
			inspecting: false,
			visible: false,
			debuggerBound: false,
			state: emptyBrowserState(viewId, normalized),
		};
		this.views.set(viewId, managed);
		this.bindWebContents(viewId, managed);
		void view.webContents.loadURL(normalized).catch(err => {
			this.logService.error('[Zyntheo Browser] loadURL failed', err);
			this.patchState(viewId, { loading: false, error: String(err) });
		});
		this.patchState(viewId, { loading: true, url: normalized, title: titleFromUrl(normalized) });
		return this.views.get(viewId)!.state;
	}

	async destroyView(viewId: string): Promise<void> {
		this.destroyManaged(viewId);
	}

	async showView(viewId: string, bounds: ZyntheoBrowserBounds, windowId: number): Promise<void> {
		const managed = this.views.get(viewId);
		if (!managed) {
			return;
		}
		const clamped = clampBrowserBounds(bounds);
		if (!clamped) {
			this.hideManaged(managed);
			return;
		}
		const win = this.getBrowserWindow(windowId) ?? this.getBrowserWindow(managed.windowId);
		if (!win) {
			return;
		}
		managed.windowId = windowId;
		this.attachView(win, managed);
		managed.view.setBounds(clamped);
	}

	async hideView(viewId: string): Promise<void> {
		const managed = this.views.get(viewId);
		if (managed) {
			this.hideManaged(managed);
		}
	}

	async navigate(viewId: string, url: string): Promise<void> {
		const managed = this.views.get(viewId);
		if (!managed) {
			return;
		}
		const normalized = normalizeBrowserUrl(url);
		this.patchState(viewId, { loading: true, url: normalized, error: undefined });
		await managed.view.webContents.loadURL(normalized).catch(err => {
			this.patchState(viewId, { loading: false, error: String(err) });
		});
	}

	async goBack(viewId: string): Promise<void> {
		this.historyOf(viewId)?.goBack();
	}

	async goForward(viewId: string): Promise<void> {
		this.historyOf(viewId)?.goForward();
	}

	async reload(viewId: string, hard?: boolean): Promise<void> {
		const contents = this.views.get(viewId)?.view.webContents;
		if (!contents) {
			return;
		}
		this.patchState(viewId, { loading: true });
		if (hard) {
			contents.reloadIgnoringCache();
		} else {
			contents.reload();
		}
	}

	async setZoom(viewId: string, factor: number): Promise<number> {
		const contents = this.views.get(viewId)?.view.webContents;
		if (!contents) {
			return 1;
		}
		const next = Math.min(5, Math.max(0.25, factor));
		contents.setZoomFactor(next);
		this.patchState(viewId, { zoomFactor: next });
		return next;
	}

	async openDevTools(viewId: string): Promise<void> {
		const contents = this.views.get(viewId)?.view.webContents;
		if (!contents) {
			return;
		}
		if (contents.isDevToolsOpened()) {
			contents.closeDevTools();
			return;
		}
		contents.openDevTools({ mode: 'detach', activate: true });
	}

	async toggleInspect(viewId: string, enabled: boolean): Promise<boolean> {
		const managed = this.views.get(viewId);
		if (!managed) {
			return false;
		}
		if (enabled) {
			const attached = await this.ensureDebugger(viewId, managed);
			if (!attached) {
				this.patchState(viewId, { inspecting: false });
				return false;
			}
			try {
				await managed.view.webContents.debugger.sendCommand('DOM.enable');
				await managed.view.webContents.debugger.sendCommand('Overlay.enable');
				await managed.view.webContents.debugger.sendCommand('Overlay.setInspectMode', {
					mode: 'searchForNode',
					highlightConfig: {
						showInfo: true,
						showRulers: false,
						showExtensionLines: false,
						contentColor: { r: 111, g: 168, b: 220, a: 0.66 },
						paddingColor: { r: 147, g: 196, b: 125, a: 0.55 },
						borderColor: { r: 255, g: 229, b: 153, a: 0.66 },
						marginColor: { r: 246, g: 178, b: 107, a: 0.66 },
					},
				});
				managed.inspecting = true;
			} catch (err) {
				this.logService.error('[Zyntheo Browser] inspect overlay failed', err);
				managed.inspecting = false;
				this.patchState(viewId, { inspecting: false });
				return false;
			}
		} else {
			await this.stopInspect(managed);
		}
		this.patchState(viewId, { inspecting: managed.inspecting });
		return managed.inspecting;
	}

	async captureScreenshot(viewId: string): Promise<ZyntheoBrowserScreenshot | undefined> {
		const managed = this.views.get(viewId);
		if (!managed) {
			return undefined;
		}
		const image = await managed.view.webContents.capturePage();
		const png = image.toPNG();
		const hostname = titleFromUrl(managed.state.url).replace(/[^\w.-]+/g, '_') || 'page';
		return {
			dataBase64: png.toString('base64'),
			mimeType: 'image/png',
			name: `${hostname}-${Date.now()}.png`,
		};
	}

	async getCurrentUrl(viewId: string): Promise<string | undefined> {
		return this.views.get(viewId)?.view.webContents.getURL();
	}

	async clearCache(viewId: string): Promise<void> {
		await this.sessionOf(viewId)?.clearCache();
	}

	async clearCookies(viewId: string): Promise<void> {
		const sess = this.sessionOf(viewId);
		if (!sess) {
			return;
		}
		await sess.clearStorageData({ storages: ['cookies'] });
	}

	async clearHistory(viewId: string): Promise<void> {
		this.historyOf(viewId)?.clear();
		this.refreshNavigation(viewId);
	}

	async getState(viewId: string): Promise<ZyntheoBrowserViewState | undefined> {
		return this.views.get(viewId)?.state;
	}

	override dispose(): void {
		for (const viewId of [...this.views.keys()]) {
			this.destroyManaged(viewId);
		}
		super.dispose();
	}

	private bindWebContents(viewId: string, managed: ManagedView): void {
		const { webContents } = managed.view;
		webContents.on('did-start-loading', () => this.patchState(viewId, { loading: true, error: undefined }));
		webContents.on('did-stop-loading', () => this.patchState(viewId, { loading: false }));
		webContents.on('did-navigate', (_event, url) => {
			this.patchState(viewId, { url, title: webContents.getTitle() || titleFromUrl(url) });
			this.refreshNavigation(viewId);
		});
		webContents.on('did-navigate-in-page', (_event, url) => {
			this.patchState(viewId, { url });
			this.refreshNavigation(viewId);
		});
		webContents.on('page-title-updated', (_event, title) => {
			this.patchState(viewId, { title: title || titleFromUrl(managed.state.url) });
		});
		webContents.on('did-fail-load', (_event, _code, errorDescription, validatedURL, isMainFrame) => {
			if (!isMainFrame) {
				return;
			}
			this.patchState(viewId, { loading: false, error: errorDescription || validatedURL });
		});
		webContents.on('destroyed', () => this.destroyManaged(viewId));
	}

	private async ensureDebugger(viewId: string, managed: ManagedView): Promise<boolean> {
		const dbg = managed.view.webContents.debugger;
		try {
			if (!dbg.isAttached()) {
				dbg.attach('1.3');
			}
		} catch (err) {
			this.logService.error('[Zyntheo Browser] debugger attach failed', err);
			return false;
		}
		if (!managed.debuggerBound) {
			dbg.on('message', (_event, method, params) => {
				if (method === 'Overlay.inspectNodeRequested') {
					void this.handleInspect(viewId, params?.backendNodeId as number | undefined);
				}
			});
			managed.debuggerBound = true;
		}
		return true;
	}

	private async handleInspect(viewId: string, backendNodeId: number | undefined): Promise<void> {
		const managed = this.views.get(viewId);
		if (!managed || !backendNodeId) {
			return;
		}
		try {
			await managed.view.webContents.debugger.sendCommand('DOM.getDocument');
			const resolved = await managed.view.webContents.debugger.sendCommand('DOM.resolveNode', { backendNodeId }) as { object?: { objectId?: string } };
			const objectId = resolved?.object?.objectId;
			if (!objectId) {
				return;
			}
			const evaluated = await managed.view.webContents.debugger.sendCommand('Runtime.callFunctionOn', {
				objectId,
				functionDeclaration: INSPECT_SCRIPT,
				returnByValue: true,
			}) as { result?: { value?: Partial<ZyntheoBrowserInspectResult> } };
			const value = evaluated?.result?.value ?? {};
			this._onDidInspectElement.fire({
				viewId,
				url: managed.state.url,
				tagName: value.tagName || 'element',
				selector: value.selector || '',
				outerHTML: value.outerHTML || '',
				innerText: value.innerText,
				computedStyle: value.computedStyle,
			});
		} catch (err) {
			this.logService.error('[Zyntheo Browser] inspect node failed', err);
		} finally {
			await this.stopInspect(managed);
			this.patchState(viewId, { inspecting: false });
		}
	}

	private async stopInspect(managed: ManagedView): Promise<void> {
		managed.inspecting = false;
		try {
			if (managed.view.webContents.debugger.isAttached()) {
				await managed.view.webContents.debugger.sendCommand('Overlay.setInspectMode', {
					mode: 'none',
					highlightConfig: { showInfo: false },
				});
			}
		} catch {
			// ignore
		}
	}

	private historyOf(viewId: string) {
		const contents = this.views.get(viewId)?.view.webContents as ({
			navigationHistory?: { canGoBack(): boolean; canGoForward(): boolean; goBack(): void; goForward(): void; clear(): void };
			canGoBack?: () => boolean;
			canGoForward?: () => boolean;
			goBack?: () => void;
			goForward?: () => void;
			clearHistory?: () => void;
		}) | undefined;
		if (!contents) {
			return undefined;
		}
		if (contents.navigationHistory) {
			return {
				canGoBack: () => contents.navigationHistory!.canGoBack(),
				canGoForward: () => contents.navigationHistory!.canGoForward(),
				goBack: () => { if (contents.navigationHistory!.canGoBack()) { contents.navigationHistory!.goBack(); } },
				goForward: () => { if (contents.navigationHistory!.canGoForward()) { contents.navigationHistory!.goForward(); } },
				clear: () => contents.navigationHistory!.clear(),
			};
		}
		return {
			canGoBack: () => !!contents.canGoBack?.(),
			canGoForward: () => !!contents.canGoForward?.(),
			goBack: () => { if (contents.canGoBack?.()) { contents.goBack?.(); } },
			goForward: () => { if (contents.canGoForward?.()) { contents.goForward?.(); } },
			clear: () => contents.clearHistory?.(),
		};
	}

	private refreshNavigation(viewId: string): void {
		const contents = this.views.get(viewId)?.view.webContents;
		if (!contents || contents.isDestroyed()) {
			return;
		}
		const history = this.historyOf(viewId);
		this.patchState(viewId, {
			canGoBack: history?.canGoBack() ?? false,
			canGoForward: history?.canGoForward() ?? false,
			zoomFactor: contents.getZoomFactor(),
		});
	}

	private patchState(viewId: string, patch: Partial<ZyntheoBrowserViewState>): void {
		const managed = this.views.get(viewId);
		if (!managed) {
			return;
		}
		managed.state = { ...managed.state, ...patch, viewId };
		this._onDidChangeState.fire(managed.state);
	}

	private sessionOf(viewId: string) {
		return this.views.get(viewId)?.view.webContents.session ?? session.fromPartition(PARTITION);
	}

	private attachView(win: BrowserWindow, managed: ManagedView): void {
		const addView = (win as BrowserWindow & { addBrowserView?: (view: BrowserView) => void }).addBrowserView;
		if (typeof addView === 'function') {
			try {
				addView.call(win, managed.view);
				managed.visible = true;
				return;
			} catch {
				// fall through
			}
		}
		try {
			win.setBrowserView(managed.view);
			managed.visible = true;
		} catch (err) {
			this.logService.error('[Zyntheo Browser] setBrowserView failed', err);
		}
	}

	private hideManaged(managed: ManagedView): void {
		const win = this.getBrowserWindow(managed.windowId);
		if (!win) {
			managed.visible = false;
			return;
		}
		const removeView = (win as BrowserWindow & { removeBrowserView?: (view: BrowserView) => void }).removeBrowserView;
		if (typeof removeView === 'function') {
			try {
				removeView.call(win, managed.view);
			} catch {
				// ignore
			}
		} else if (win.getBrowserView() === managed.view) {
			win.setBrowserView(null);
		}
		managed.visible = false;
	}

	private destroyManaged(viewId: string): void {
		const managed = this.views.get(viewId);
		if (!managed) {
			return;
		}
		this.hideManaged(managed);
		try {
			if (managed.view.webContents.debugger.isAttached()) {
				managed.view.webContents.debugger.detach();
			}
		} catch {
			// ignore
		}
		try {
			(managed.view.webContents as { destroy?: () => void }).destroy?.();
		} catch {
			// ignore
		}
		this.views.delete(viewId);
	}

	private getBrowserWindow(windowId: number): BrowserWindow | undefined {
		return this.windowsMainService.getWindowById(windowId)?.win ?? BrowserWindow.fromId(windowId) ?? undefined;
	}
}
