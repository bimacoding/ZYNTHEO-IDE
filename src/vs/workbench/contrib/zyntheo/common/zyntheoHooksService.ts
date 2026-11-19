/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js'
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js'
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js'
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js'
import {
	ZyntheoHookEvent,
	ZyntheoHookPayload,
	ZyntheoHookRunResult,
	selectMatchingHooks,
} from './zyntheoHooks.js'
import { IZyntheoRulesSkillsService } from './zyntheoRulesService.js'

export interface IZyntheoHooksService {
	readonly _serviceBrand: undefined
	run(event: ZyntheoHookEvent, payload: Omit<ZyntheoHookPayload, 'event'>): Promise<ZyntheoHookRunResult>
}

export const IZyntheoHooksService = createDecorator<IZyntheoHooksService>('zyntheoHooksService')

class ZyntheoHooksService extends Disposable implements IZyntheoHooksService {
	declare readonly _serviceBrand: undefined
	private readonly channel: IChannel | undefined

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IZyntheoRulesSkillsService private readonly rulesSkillsService: IZyntheoRulesSkillsService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super()
		try {
			this.channel = mainProcessService.getChannel('zyntheo-channel-hooks')
		} catch {
			this.channel = undefined
		}
	}

	async run(event: ZyntheoHookEvent, payload: Omit<ZyntheoHookPayload, 'event'>): Promise<ZyntheoHookRunResult> {
		const snapshot = this.rulesSkillsService.getCachedSnapshot()
		const hooks = selectMatchingHooks(snapshot.hooks, event, payload.toolName as string | undefined)
		if (!hooks.length) {
			return { permission: 'allow' }
		}
		if (!this.channel) {
			return { permission: 'allow' }
		}

		const cwd = this.workspaceContextService.getWorkspace().folders[0]?.uri.fsPath
		for (const hook of hooks) {
			try {
				const result = await this.channel.call<ZyntheoHookRunResult>('runHook', {
					command: hook.command,
					cwd,
					timeoutMs: hook.timeoutMs,
					payload: { ...payload, event, command: hook.command },
				})
				if (result.permission === 'deny') {
					return result
				}
			} catch (error) {
				console.warn('Zyntheo hook failed:', event, error)
			}
		}
		return { permission: 'allow' }
	}
}

registerSingleton(IZyntheoHooksService, ZyntheoHooksService, InstantiationType.Delayed)
