/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Dimension, addDisposableListener } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext, IEditorSerializer } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { localize } from '../../../../nls.js';
import { IChatThreadService } from './chatThreadService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ZYNTHEO_VIEW_CONTAINER_ID } from './sidebarPane.js';
import { createImageStagingSelection } from '../common/chatAttachments.js';
import {
	DEFAULT_BROWSER_URL,
	ZYNTHEO_BROWSER_SCHEME,
	emptyBrowserState,
	formatInspectResult,
	formatZoomPercent,
	nextZoomFactor,
	normalizeBrowserUrl,
	titleFromUrl,
	ZyntheoBrowserInspectResult,
	ZyntheoBrowserViewState,
} from '../common/zyntheoBrowser.js';
import { IZyntheoBrowserService } from '../common/zyntheoBrowserService.js';

export class ZyntheoBrowserEditorInput extends EditorInput {
	static readonly ID = 'workbench.input.zyntheo.browser';

	private readonly id: string;
	private _url: string;
	private _title: string;

	constructor(url?: string, id?: string) {
		super();
		this.id = id || generateUuid();
		this._url = normalizeBrowserUrl(url);
		this._title = titleFromUrl(this._url);
	}

	override get typeId(): string {
		return ZyntheoBrowserEditorInput.ID;
	}

	override get editorId(): string | undefined {
		return ZyntheoBrowserEditorInput.ID;
	}

	override get resource(): URI {
		return URI.from({ scheme: ZYNTHEO_BROWSER_SCHEME, path: this.id });
	}

	get tabId(): string {
		return this.id;
	}

	get url(): string {
		return this._url;
	}

	setUrl(url: string, title?: string): void {
		const next = normalizeBrowserUrl(url);
		if (next === this._url && (!title || title === this._title)) {
			return;
		}
		this._url = next;
		this._title = title || titleFromUrl(next);
		this._onDidChangeLabel.fire();
	}

	override getName(): string {
		return this._title || localize('zyntheoBrowserTab', 'Browser');
	}

	override getIcon() {
		return Codicon.globe;
	}

	override matches(other: EditorInput): boolean {
		return other instanceof ZyntheoBrowserEditorInput && other.id === this.id;
	}
}

export class ZyntheoBrowserEditorInputSerializer implements IEditorSerializer {
	canSerialize(editor: EditorInput): boolean {
		return editor instanceof ZyntheoBrowserEditorInput;
	}

	serialize(editor: EditorInput): string | undefined {
		if (!(editor instanceof ZyntheoBrowserEditorInput)) {
			return undefined;
		}
		return JSON.stringify({ url: editor.url });
	}

	deserialize(_instantiationService: IInstantiationService, serializedEditor: string): EditorInput | undefined {
		try {
			const parsed = JSON.parse(serializedEditor) as { url?: string };
			return new ZyntheoBrowserEditorInput(parsed.url);
		} catch {
			return new ZyntheoBrowserEditorInput();
		}
	}
}

export class ZyntheoBrowserEditorPane extends EditorPane {
	static readonly ID = 'workbench.editor.zyntheo.browser';

	private currentViewId: string | undefined;
	private readonly knownViewIds = new Set<string>();
	private readonly layoutStore = this._register(new DisposableStore());
	private root: HTMLElement | undefined;
	private toolbar: HTMLElement | undefined;
	private viewport: HTMLElement | undefined;
	private urlInput: HTMLInputElement | undefined;
	private zoomLabel: HTMLElement | undefined;
	private inspectButton: HTMLButtonElement | undefined;
	private moreMenu: HTMLElement | undefined;
	private state: ZyntheoBrowserViewState = emptyBrowserState('pending');
	private overlayVisible = false;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IZyntheoBrowserService private readonly browserService: IZyntheoBrowserService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
		@IViewsService private readonly viewsService: IViewsService,
		@INotificationService private readonly notificationService: INotificationService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@IQuickInputService quickInputService: IQuickInputService,
	) {
		super(ZyntheoBrowserEditorPane.ID, group, telemetryService, themeService, storageService);

		this._register(this.browserService.onDidChangeState(state => {
			if (state.viewId === this.currentViewId) {
				this.applyState(state);
			}
		}));
		this._register(this.browserService.onDidInspectElement(result => {
			if (result.viewId === this.currentViewId) {
				void this.onInspected(result);
			}
		}));
		this._register(toDisposable(() => {
			for (const viewId of this.knownViewIds) {
				void this.browserService.destroyView(viewId);
			}
			this.knownViewIds.clear();
		}));
		this._register(quickInputService.onShow(() => {
			if (this.currentViewId) {
				void this.browserService.hideView(this.currentViewId);
			}
		}));
		this._register(quickInputService.onHide(() => {
			this.syncOverlay();
		}));
	}

	protected createEditor(parent: HTMLElement): void {
		this.root = parent;
		parent.classList.add('zyntheo-browser-editor');

		this.toolbar = document.createElement('div');
		this.toolbar.className = 'zyntheo-browser-toolbar';
		parent.appendChild(this.toolbar);

		const nav = document.createElement('nav');
		nav.className = 'zyntheo-browser-nav';
		this.toolbar.appendChild(nav);

		this.addIconButton(nav, Codicon.arrowLeft, localize('zyntheoBrowserBack', 'Back'), () => this.withView(viewId => this.browserService.goBack(viewId)), 'back');
		this.addIconButton(nav, Codicon.arrowRight, localize('zyntheoBrowserForward', 'Forward'), () => this.withView(viewId => this.browserService.goForward(viewId)), 'forward');
		this.addIconButton(nav, Codicon.refresh, localize('zyntheoBrowserReload', 'Reload'), () => this.withView(viewId => this.browserService.reload(viewId)), 'reload');

		this.urlInput = document.createElement('input');
		this.urlInput.className = 'zyntheo-browser-url';
		this.urlInput.type = 'text';
		this.urlInput.spellcheck = false;
		this.urlInput.placeholder = localize('zyntheoBrowserUrlPlaceholder', 'Search or enter URL');
		this.urlInput.setAttribute('aria-label', localize('zyntheoBrowserUrlAria', 'Browser address'));
		this.toolbar.appendChild(this.urlInput);
		this.layoutStore.add(addDisposableListener(this.urlInput, 'keydown', e => {
			const event = new StandardKeyboardEvent(e);
			if (event.keyCode === KeyCode.Enter) {
				event.preventDefault();
				void this.withView(viewId => this.browserService.navigate(viewId, this.urlInput?.value || DEFAULT_BROWSER_URL));
			} else if (event.keyCode === KeyCode.Escape) {
				this.urlInput!.value = this.state.url;
				this.urlInput!.blur();
			}
		}));

		const tools = document.createElement('nav');
		tools.className = 'zyntheo-browser-tools';
		this.toolbar.appendChild(tools);

		this.inspectButton = this.addIconButton(tools, Codicon.inspect, localize('zyntheoBrowserSelectElement', 'Select Element'), () => {
			void this.toggleInspect();
		}, 'inspect');
		this.addIconButton(tools, Codicon.debugConsole, localize('zyntheoBrowserOpenConsole', 'Open Console'), () => this.openConsole());
		this.addIconButton(tools, Codicon.deviceCamera, localize('zyntheoBrowserScreenshot', 'Take Screenshot'), () => this.takeScreenshot());
		this.addIconButton(tools, Codicon.linkExternal, localize('zyntheoBrowserOpenExternal', 'Open in System Browser'), () => this.openExternal());

		const moreWrap = document.createElement('div');
		moreWrap.className = 'zyntheo-browser-more';
		tools.appendChild(moreWrap);
		this.addIconButton(moreWrap, Codicon.ellipsis, localize('zyntheoBrowserMore', 'More browser actions'), () => this.toggleMoreMenu());
		this.moreMenu = document.createElement('div');
		this.moreMenu.className = 'zyntheo-browser-menu';
		this.moreMenu.hidden = true;
		moreWrap.appendChild(this.moreMenu);
		this.addMenuItem(localize('zyntheoBrowserCaptureArea', 'Capture Area Screenshot'), () => this.takeScreenshot());
		this.addMenuItem(localize('zyntheoBrowserHardReload', 'Hard Reload'), () => this.withView(viewId => this.browserService.reload(viewId, true)));
		this.addMenuItem(localize('zyntheoBrowserCopyUrl', 'Copy Current URL'), () => this.copyUrl());
		this.addMenuDivider();
		this.addZoomRow();
		this.addMenuDivider();
		this.addMenuItem(localize('zyntheoBrowserClearHistory', 'Clear Browsing History'), () => this.clearHistory());
		this.addMenuItem(localize('zyntheoBrowserClearCookies', 'Clear Cookies'), () => this.clearCookies());
		this.addMenuItem(localize('zyntheoBrowserClearCache', 'Clear Cache'), () => this.clearCache());

		this.viewport = document.createElement('div');
		this.viewport.className = 'zyntheo-browser-viewport';
		parent.appendChild(this.viewport);
		this.layoutStore.add(addDisposableListener(this.viewport.ownerDocument, 'pointerdown', e => {
			if (this.moreMenu && !this.moreMenu.hidden && !moreWrap.contains(e.target as Node)) {
				this.moreMenu.hidden = true;
			}
		}));
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (!(input instanceof ZyntheoBrowserEditorInput) || token.isCancellationRequested) {
			return;
		}
		const url = input.url || DEFAULT_BROWSER_URL;
		if (this.currentViewId && this.currentViewId !== input.tabId) {
			await this.browserService.hideView(this.currentViewId);
		}
		this.currentViewId = input.tabId;
		if (!this.knownViewIds.has(input.tabId)) {
			this.knownViewIds.add(input.tabId);
			await this.browserService.createView(input.tabId, this.windowId, url);
			this._register(input.onWillDispose(() => {
				void this.browserService.destroyView(input.tabId);
				this.knownViewIds.delete(input.tabId);
				if (this.currentViewId === input.tabId) {
					this.currentViewId = undefined;
				}
			}));
		}
		if (this.urlInput) {
			this.urlInput.value = url;
		}
		this.syncOverlay();
	}

	override layout(dimension: Dimension): void {
		if (this.root) {
			this.root.style.height = `${dimension.height}px`;
			this.root.style.width = `${dimension.width}px`;
		}
		this.syncOverlay();
	}

	protected override setEditorVisible(visible: boolean): void {
		super.setEditorVisible(visible);
		this.overlayVisible = visible;
		if (!visible) {
			if (this.currentViewId) {
				void this.browserService.hideView(this.currentViewId);
			}
			if (this.moreMenu) {
				this.moreMenu.hidden = true;
			}
		} else {
			this.syncOverlay();
		}
	}

	override clearInput(): void {
		if (this.currentViewId) {
			void this.browserService.hideView(this.currentViewId);
		}
		super.clearInput();
	}

	override focus(): void {
		this.urlInput?.focus();
		this.urlInput?.select();
	}

	toggleInspect(): Promise<boolean> {
		return this.currentViewId ? this.browserService.toggleInspect(this.currentViewId, !this.state.inspecting) : Promise.resolve(false);
	}

	openConsole(): Promise<void> {
		return this.currentViewId ? this.browserService.openDevTools(this.currentViewId) : Promise.resolve();
	}

	private async withView(run: (viewId: string) => void | Promise<void>): Promise<void> {
		if (this.currentViewId) {
			await run(this.currentViewId);
		}
	}

	private get windowId(): number {
		return this.group.windowId;
	}

	private applyState(state: ZyntheoBrowserViewState): void {
		this.state = state;
		if (this.urlInput && this.getContainer()?.ownerDocument.activeElement !== this.urlInput) {
			this.urlInput.value = state.url;
		}
		if (this.zoomLabel) {
			this.zoomLabel.textContent = formatZoomPercent(state.zoomFactor);
		}
		this.root?.classList.toggle('inspecting', state.inspecting);
		this.root?.classList.toggle('loading', state.loading);
		this.inspectButton?.classList.toggle('active', state.inspecting);
		const back = this.toolbar?.querySelector<HTMLButtonElement>('[data-action="back"]');
		const forward = this.toolbar?.querySelector<HTMLButtonElement>('[data-action="forward"]');
		if (back) { back.disabled = !state.canGoBack; }
		if (forward) { forward.disabled = !state.canGoForward; }
		if (this.input instanceof ZyntheoBrowserEditorInput) {
			this.input.setUrl(state.url, state.title);
		}
	}

	private syncOverlay(): void {
		if (!this.overlayVisible || !this.viewport || !this.currentViewId) {
			return;
		}
		const rect = this.viewport.getBoundingClientRect();
		void this.browserService.showView(this.currentViewId, {
			x: Math.round(rect.left),
			y: Math.round(rect.top),
			width: Math.round(rect.width),
			height: Math.round(rect.height),
		}, this.windowId);
	}

	private addIconButton(parent: HTMLElement, icon: ThemeIcon, title: string, onClick: () => void, action?: string): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = `zyntheo-browser-btn ${ThemeIcon.asClassName(icon)}`;
		button.title = title;
		button.setAttribute('aria-label', title);
		if (action) {
			button.dataset.action = action;
		}
		this.layoutStore.add(addDisposableListener(button, 'click', e => {
			e.preventDefault();
			e.stopPropagation();
			onClick();
		}));
		parent.appendChild(button);
		return button;
	}

	private addMenuItem(label: string, onClick: () => void): void {
		if (!this.moreMenu) {
			return;
		}
		const item = document.createElement('button');
		item.type = 'button';
		item.className = 'zyntheo-browser-menu-item';
		item.textContent = label;
		this.layoutStore.add(addDisposableListener(item, 'click', e => {
			e.preventDefault();
			e.stopPropagation();
			this.moreMenu!.hidden = true;
			onClick();
		}));
		this.moreMenu.appendChild(item);
	}

	private addMenuDivider(): void {
		if (!this.moreMenu) {
			return;
		}
		const divider = document.createElement('div');
		divider.className = 'zyntheo-browser-menu-divider';
		this.moreMenu.appendChild(divider);
	}

	private addZoomRow(): void {
		if (!this.moreMenu) {
			return;
		}
		const row = document.createElement('div');
		row.className = 'zyntheo-browser-zoom';
		const label = document.createElement('span');
		label.textContent = localize('zyntheoBrowserZoom', 'Zoom');
		row.appendChild(label);
		const minus = document.createElement('button');
		minus.type = 'button';
		minus.textContent = '−';
		this.layoutStore.add(addDisposableListener(minus, 'click', () => {
			void this.withView(async viewId => {
				await this.browserService.setZoom(viewId, nextZoomFactor(this.state.zoomFactor, -1));
			});
		}));
		row.appendChild(minus);
		this.zoomLabel = document.createElement('span');
		this.zoomLabel.className = 'zyntheo-browser-zoom-value';
		this.zoomLabel.textContent = '100%';
		row.appendChild(this.zoomLabel);
		const plus = document.createElement('button');
		plus.type = 'button';
		plus.textContent = '+';
		this.layoutStore.add(addDisposableListener(plus, 'click', () => {
			void this.withView(async viewId => {
				await this.browserService.setZoom(viewId, nextZoomFactor(this.state.zoomFactor, 1));
			});
		}));
		row.appendChild(plus);
		const reset = document.createElement('button');
		reset.type = 'button';
		reset.title = localize('zyntheoBrowserZoomReset', 'Reset zoom');
		reset.className = ThemeIcon.asClassName(Codicon.discard);
		this.layoutStore.add(addDisposableListener(reset, 'click', () => {
			void this.withView(async viewId => {
				await this.browserService.setZoom(viewId, 1);
			});
		}));
		row.appendChild(reset);
		this.moreMenu.appendChild(row);
	}

	private toggleMoreMenu(): void {
		if (!this.moreMenu) {
			return;
		}
		this.moreMenu.hidden = !this.moreMenu.hidden;
	}

	private async takeScreenshot(): Promise<void> {
		if (!this.currentViewId) {
			return;
		}
		const shot = await this.browserService.captureScreenshot(this.currentViewId);
		if (!shot) {
			this.notificationService.warn(localize('zyntheoBrowserScreenshotFailed', 'Could not capture a screenshot.'));
			return;
		}
		this.chatThreadService.addNewStagingSelection(createImageStagingSelection({
			name: shot.name,
			mimeType: shot.mimeType,
			dataBase64: shot.dataBase64,
		}));
		await this.viewsService.openViewContainer(ZYNTHEO_VIEW_CONTAINER_ID);
		await this.chatThreadService.focusCurrentChat();
		this.notificationService.info(localize('zyntheoBrowserScreenshotAdded', 'Screenshot attached to chat.'));
	}

	private async onInspected(result: ZyntheoBrowserInspectResult): Promise<void> {
		await this.insertIntoChat(formatInspectResult(result));
		this.notificationService.info(localize('zyntheoBrowserElementSelected', 'Selected element sent to chat.'));
	}

	private async insertIntoChat(text: string): Promise<void> {
		await this.viewsService.openViewContainer(ZYNTHEO_VIEW_CONTAINER_ID);
		await this.chatThreadService.focusCurrentChat();
		const thread = this.chatThreadService.getCurrentThread();
		const mounted = await thread.state.mountedInfo?.whenMounted;
		const textarea = mounted?.textAreaRef.current;
		if (textarea) {
			const prefix = textarea.value.trim() ? `${textarea.value.trim()}\n\n` : '';
			textarea.value = `${prefix}${text}`;
			textarea.dispatchEvent(new Event('input', { bubbles: true }));
			textarea.focus();
			return;
		}
		await this.clipboardService.writeText(text);
		this.notificationService.info(localize('zyntheoBrowserCopiedFallback', 'Copied selected element to clipboard.'));
	}

	private async openExternal(): Promise<void> {
		const url = this.state.url || this.urlInput?.value;
		if (!url) {
			return;
		}
		await this.openerService.open(URI.parse(url), { openExternal: true });
	}

	private async copyUrl(): Promise<void> {
		const url = (this.currentViewId ? await this.browserService.getCurrentUrl(this.currentViewId) : undefined) || this.state.url;
		await this.clipboardService.writeText(url);
		this.notificationService.info(localize('zyntheoBrowserUrlCopied', 'Copied current URL.'));
	}

	private async clearCache(): Promise<void> {
		await this.withView(viewId => this.browserService.clearCache(viewId));
		this.notificationService.info(localize('zyntheoBrowserCacheCleared', 'Browser cache cleared.'));
	}

	private async clearCookies(): Promise<void> {
		await this.withView(viewId => this.browserService.clearCookies(viewId));
		this.notificationService.info(localize('zyntheoBrowserCookiesCleared', 'Cookies cleared.'));
	}

	private async clearHistory(): Promise<void> {
		await this.withView(viewId => this.browserService.clearHistory(viewId));
		this.notificationService.info(localize('zyntheoBrowserHistoryCleared', 'Browsing history cleared.'));
	}
}
