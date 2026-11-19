/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export const ZYNTHEO_HOOKS_FILE = 'hooks.json'

export const ZYNTHEO_HOOK_EVENTS = [
	'beforeSubmitPrompt',
	'preToolUse',
	'postToolUse',
	'postToolUseFailure',
	'stop',
] as const

export type ZyntheoHookEvent = typeof ZYNTHEO_HOOK_EVENTS[number]

export type ZyntheoHookCommand = {
	command: string
	matcher?: string
	timeoutMs?: number
}

export type ZyntheoHooksConfig = {
	version: number
	hooks: Partial<Record<ZyntheoHookEvent, ZyntheoHookCommand[]>>
}

export type ZyntheoHookPermission = 'allow' | 'deny'

export type ZyntheoHookRunResult = {
	permission: ZyntheoHookPermission
	message?: string
	stdout?: string
	exitCode?: number
}

export type ZyntheoHookPayload = {
	event: ZyntheoHookEvent
	threadId?: string
	toolName?: string
	command?: string
	userMessage?: string
	[key: string]: unknown
}

export function isHookEvent(value: unknown): value is ZyntheoHookEvent {
	return typeof value === 'string' && (ZYNTHEO_HOOK_EVENTS as readonly string[]).includes(value)
}

export function parseHooksConfig(raw: string): ZyntheoHooksConfig {
	const parsed = JSON.parse(raw) as Partial<ZyntheoHooksConfig> & { hooks?: Record<string, unknown> }
	const hooks: ZyntheoHooksConfig['hooks'] = {}
	const source = parsed.hooks && typeof parsed.hooks === 'object' ? parsed.hooks : {}
	for (const [event, entries] of Object.entries(source)) {
		if (!isHookEvent(event) || !Array.isArray(entries)) {
			continue
		}
		hooks[event] = entries.map(normalizeHookCommand).filter((entry): entry is ZyntheoHookCommand => !!entry)
	}
	return {
		version: typeof parsed.version === 'number' ? parsed.version : 1,
		hooks,
	}
}

export function mergeHooksConfigs(base: ZyntheoHooksConfig | undefined, overlay: ZyntheoHooksConfig | undefined): ZyntheoHooksConfig {
	const hooks: ZyntheoHooksConfig['hooks'] = {}
	for (const event of ZYNTHEO_HOOK_EVENTS) {
		const combined = [
			...(base?.hooks[event] || []),
			...(overlay?.hooks[event] || []),
		]
		if (combined.length) {
			hooks[event] = combined
		}
	}
	return {
		version: overlay?.version || base?.version || 1,
		hooks,
	}
}

export function selectMatchingHooks(config: ZyntheoHooksConfig | undefined, event: ZyntheoHookEvent, toolName?: string): ZyntheoHookCommand[] {
	const list = config?.hooks[event] || []
	return list.filter(entry => hookMatches(entry.matcher, toolName))
}

export function hookMatches(matcher: string | undefined, toolName: string | undefined): boolean {
	if (!matcher || !matcher.trim()) {
		return true
	}
	if (!toolName) {
		return true
	}
	try {
		return new RegExp(matcher).test(toolName)
	} catch {
		return toolName.includes(matcher)
	}
}

export function interpretHookOutput(opts: { exitCode: number; stdout: string; stderr: string }): ZyntheoHookRunResult {
	const stdout = (opts.stdout || '').trim()
	const stderr = (opts.stderr || '').trim()
	if (stdout) {
		try {
			const parsed = JSON.parse(stdout) as Record<string, unknown>
			const permission = parsePermission(parsed)
			if (permission) {
				return {
					permission,
					message: asString(parsed.message || parsed.reason || parsed.error),
					stdout,
					exitCode: opts.exitCode,
				}
			}
			if (parsed.continue === false || parsed.allow === false) {
				return { permission: 'deny', message: asString(parsed.message), stdout, exitCode: opts.exitCode }
			}
		} catch {
			// not JSON; fall through to exit code
		}
	}
	if (opts.exitCode === 2) {
		return { permission: 'deny', message: stderr || stdout || 'Hook denied the action.', stdout, exitCode: 2 }
	}
	if (opts.exitCode !== 0) {
		return { permission: 'allow', message: stderr || stdout, stdout, exitCode: opts.exitCode }
	}
	return { permission: 'allow', stdout, exitCode: 0 }
}

function normalizeHookCommand(value: unknown): ZyntheoHookCommand | undefined {
	if (typeof value === 'string' && value.trim()) {
		return { command: value.trim() }
	}
	if (!value || typeof value !== 'object') {
		return undefined
	}
	const record = value as Record<string, unknown>
	const command = typeof record.command === 'string' ? record.command.trim() : ''
	if (!command) {
		return undefined
	}
	return {
		command,
		matcher: typeof record.matcher === 'string' ? record.matcher : undefined,
		timeoutMs: typeof record.timeoutMs === 'number' ? record.timeoutMs : (typeof record.timeout === 'number' ? record.timeout : undefined),
	}
}

function parsePermission(parsed: Record<string, unknown>): ZyntheoHookPermission | undefined {
	const value = parsed.permission ?? parsed.decision ?? parsed.action
	if (value === 'allow' || value === 'approve' || value === 'allowOnce') {
		return 'allow'
	}
	if (value === 'deny' || value === 'block' || value === 'reject') {
		return 'deny'
	}
	return undefined
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value : undefined
}
