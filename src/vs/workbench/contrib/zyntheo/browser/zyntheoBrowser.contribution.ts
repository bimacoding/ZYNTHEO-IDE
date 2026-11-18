/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { ActiveEditorContext } from '../../../common/contextkeys.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { DEFAULT_BROWSER_URL, normalizeBrowserUrl } from '../common/zyntheoBrowser.js';
import { IZyntheoBrowserService } from '../common/zyntheoBrowserService.js';
import { ZyntheoBrowserEditorInput, ZyntheoBrowserEditorInputSerializer, ZyntheoBrowserEditorPane } from './zyntheoBrowserEditor.js';

export const ZYNTHEO_OPEN_BROWSER_ACTION_ID = 'zyntheo.browser.open';
export const ZYNTHEO_BROWSER_SELECT_ELEMENT_ACTION_ID = 'zyntheo.browser.selectElement';
export const ZYNTHEO_BROWSER_OPEN_CONSOLE_ACTION_ID = 'zyntheo.browser.openConsole';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		ZyntheoBrowserEditorPane,
		ZyntheoBrowserEditorPane.ID,
		localize('zyntheoBrowserPane', 'Browser'),
	),
	[new SyncDescriptor(ZyntheoBrowserEditorInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
	ZyntheoBrowserEditorInput.ID,
	ZyntheoBrowserEditorInputSerializer,
);

async function openZyntheoBrowser(accessor: ServicesAccessor, url?: string): Promise<void> {
	const editorService = accessor.get(IEditorService);
	const input = new ZyntheoBrowserEditorInput(url);
	await editorService.openEditor(input, { pinned: true });
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: ZYNTHEO_OPEN_BROWSER_ACTION_ID,
			title: localize2('zyntheoOpenBrowser', 'Zyntheo: Open Browser'),
			f1: true,
			icon: Codicon.globe,
			menu: [
				{
					id: MenuId.LayoutControlMenu,
					group: 'z_end',
					order: 2,
				},
				{
					id: MenuId.MenubarViewMenu,
					group: '4_panels',
					order: 3,
				},
			],
		});
	}

	async run(accessor: ServicesAccessor, url?: string | URI): Promise<void> {
		if (typeof url === 'string') {
			await openZyntheoBrowser(accessor, url);
			return;
		}
		if (URI.isUri(url)) {
			await openZyntheoBrowser(accessor, url.toString(true));
			return;
		}
		const quickInput = accessor.get(IQuickInputService);
		const value = await quickInput.input({
			title: localize('zyntheoBrowserPromptTitle', 'Open Browser'),
			placeHolder: localize('zyntheoBrowserPromptPlaceholder', 'https://localhost:3000 or search the web'),
			value: DEFAULT_BROWSER_URL,
		});
		await openZyntheoBrowser(accessor, value ? normalizeBrowserUrl(value) : DEFAULT_BROWSER_URL);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'zyntheo.browser.openLocalhost',
			title: localize2('zyntheoOpenLocalhostBrowser', 'Zyntheo: Open Localhost in Browser'),
			f1: true,
			icon: Codicon.server,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await openZyntheoBrowser(accessor, 'http://localhost:3000');
	}
});

function activeBrowserPane(accessor: ServicesAccessor): ZyntheoBrowserEditorPane | undefined {
	const pane = accessor.get(IEditorService).activeEditorPane;
	return pane instanceof ZyntheoBrowserEditorPane ? pane : undefined;
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: ZYNTHEO_BROWSER_SELECT_ELEMENT_ACTION_ID,
			title: localize2('zyntheoBrowserSelectElementCmd', 'Zyntheo Browser: Select Element'),
			f1: true,
			icon: Codicon.inspect,
			precondition: ActiveEditorContext.isEqualTo(ZyntheoBrowserEditorPane.ID),
			menu: {
				id: MenuId.EditorTitle,
				when: ActiveEditorContext.isEqualTo(ZyntheoBrowserEditorPane.ID),
				group: 'navigation',
				order: 1,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const pane = activeBrowserPane(accessor);
		if (!pane) {
			await openZyntheoBrowser(accessor);
			return;
		}
		await pane.toggleInspect();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: ZYNTHEO_BROWSER_OPEN_CONSOLE_ACTION_ID,
			title: localize2('zyntheoBrowserOpenConsoleCmd', 'Zyntheo Browser: Open Console'),
			f1: true,
			icon: Codicon.debugConsole,
			precondition: ActiveEditorContext.isEqualTo(ZyntheoBrowserEditorPane.ID),
			menu: {
				id: MenuId.EditorTitle,
				when: ActiveEditorContext.isEqualTo(ZyntheoBrowserEditorPane.ID),
				group: 'navigation',
				order: 2,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		let pane = activeBrowserPane(accessor);
		if (!pane) {
			await openZyntheoBrowser(accessor);
			pane = activeBrowserPane(accessor);
		}
		await pane?.openConsole();
	}
});

class ZyntheoBrowserNewTabContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.zyntheoBrowserNewTab';

	constructor(
		@IZyntheoBrowserService browserService: IZyntheoBrowserService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this._register(browserService.onDidRequestNewTab(request => {
			void instantiationService.invokeFunction(accessor => openZyntheoBrowser(accessor, request.url));
		}));
	}
}

registerWorkbenchContribution2(ZyntheoBrowserNewTabContribution.ID, ZyntheoBrowserNewTabContribution, WorkbenchPhase.AfterRestored);
