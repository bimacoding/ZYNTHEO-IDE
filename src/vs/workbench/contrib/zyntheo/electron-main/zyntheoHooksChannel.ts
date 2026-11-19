/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { spawn } from 'child_process'
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js'
import { Event } from '../../../../base/common/event.js'
import { interpretHookOutput, ZyntheoHookPayload, ZyntheoHookRunResult } from '../common/zyntheoHooks.js'

export class ZyntheoHooksChannel implements IServerChannel {
	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`)
	}

	async call(_: unknown, command: string, params: any): Promise<any> {
		if (command !== 'runHook') {
			throw new Error(`Unknown hooks command: ${command}`)
		}
		return this._runHook(params)
	}

	private _runHook(params: { command: string; cwd?: string; timeoutMs?: number; payload: ZyntheoHookPayload }): Promise<ZyntheoHookRunResult> {
		const timeoutMs = Math.min(Math.max(params.timeoutMs ?? 15_000, 1_000), 60_000)
		return new Promise(resolve => {
			let stdout = ''
			let stderr = ''
			let settled = false
			const child = spawn(params.command, {
				shell: true,
				cwd: params.cwd,
				env: process.env,
			})

			const finish = (exitCode: number) => {
				if (settled) {
					return
				}
				settled = true
				resolve(interpretHookOutput({ exitCode, stdout, stderr }))
			}

			const timer = setTimeout(() => {
				child.kill('SIGKILL')
				finish(124)
			}, timeoutMs)

			child.stdout?.on('data', (chunk: Buffer | string) => { stdout += chunk.toString() })
			child.stderr?.on('data', (chunk: Buffer | string) => { stderr += chunk.toString() })
			child.on('error', (err) => {
				clearTimeout(timer)
				if (settled) {
					return
				}
				settled = true
				resolve({ permission: 'allow', message: err.message, exitCode: 1 })
			})
			child.on('close', (code) => {
				clearTimeout(timer)
				finish(code ?? 1)
			})

			try {
				child.stdin?.write(JSON.stringify(params.payload))
				child.stdin?.end()
			} catch {
				// command may not read stdin
			}
		})
	}
}
