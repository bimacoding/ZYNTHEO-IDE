/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChatMode, normalizeChatMode } from './zyntheoSettingsTypes.js'
import { parseFrontmatter, slugifySkillName, fileNameFromPath, stemFromFileName } from './zyntheoRules.js'

export const ZYNTHEO_AGENTS_DIR = 'agents'
export const MAX_SUBAGENT_PROMPT_CHARS = 80_000

export type ZyntheoSubagentSource = 'builtin' | 'workspace' | 'user' | 'legacy'

export type ZyntheoSubagent = {
	id: string
	name: string
	path?: string
	source: ZyntheoSubagentSource
	description: string
	readonly: boolean
	chatMode: ChatMode
	body: string
}

export const BUILTIN_SUBAGENTS: ZyntheoSubagent[] = [
	{
		id: 'builtin:explore',
		name: 'explore',
		source: 'builtin',
		description: 'Read-only codebase explorer. Use to search, read, and summarize without editing files.',
		readonly: true,
		chatMode: 'ask',
		body: `You are a read-only explorer subagent.
Stay scoped to the assigned question.
Use search and read tools extensively.
Do not edit files or run mutating commands.
Return a concise summary of findings, file paths, and remaining questions.`,
	},
	{
		id: 'builtin:plan',
		name: 'plan',
		source: 'builtin',
		description: 'Planning specialist. Use to design an implementation approach before coding.',
		readonly: true,
		chatMode: 'plan',
		body: `You are a planning subagent.
Inspect the codebase, then produce a concrete plan: goal, files, steps, risks, and verification.
Do not implement the plan.`,
	},
	{
		id: 'builtin:debug',
		name: 'debug',
		source: 'builtin',
		description: 'Debugger. Use for stack traces, failing tests, and targeted fixes.',
		readonly: false,
		chatMode: 'debug',
		body: `You are a debug subagent.
Diagnose first with evidence, then apply the smallest correct fix.
Report root cause, change, and how you verified it.`,
	},
	{
		id: 'builtin:generalPurpose',
		name: 'generalPurpose',
		source: 'builtin',
		description: 'General-purpose coding agent. Use for a focused implementation task.',
		readonly: false,
		chatMode: 'agent',
		body: `You are a focused implementation subagent.
Stay strictly scoped to the assigned task.
Make the smallest correct change and summarize what you did.`,
	},
]

export function parseAgentDocument(opts: { path: string; content: string; source: Exclude<ZyntheoSubagentSource, 'builtin'> }): ZyntheoSubagent {
	const fileName = fileNameFromPath(opts.path)
	const { frontmatter, body } = parseFrontmatter(opts.content)
	const fallbackName = stemFromFileName(fileName)
	const name = slugifySkillName(frontmatter.name || fallbackName) || fallbackName
	const readonly = frontmatter.raw.readonly
		? ['true', 'yes', '1'].includes(String(frontmatter.raw.readonly).trim().toLowerCase())
		: false
	const modeRaw = frontmatter.raw.chatMode || frontmatter.raw.mode || frontmatter.raw.model
	const chatMode = modeRaw ? normalizeChatMode(modeRaw) : (readonly ? 'ask' : 'agent')
	return {
		id: `${opts.source}:${opts.path.replace(/\\/g, '/')}`,
		name,
		path: opts.path,
		source: opts.source,
		description: frontmatter.description || '',
		readonly,
		chatMode: readonly && chatMode === 'agent' ? 'ask' : chatMode,
		body: clipAgentText(body || opts.content.trim()),
	}
}

export function resolveSubagent(name: string, custom: ZyntheoSubagent[]): ZyntheoSubagent | undefined {
	const key = slugifySkillName(name) || name.trim().toLowerCase()
	const rank: Record<ZyntheoSubagentSource, number> = { workspace: 0, user: 1, legacy: 2, builtin: 3 }
	const all = [...custom, ...BUILTIN_SUBAGENTS].sort((a, b) => rank[a.source] - rank[b.source])
	return all.find(agent => agent.name.toLowerCase() === key || agent.name.toLowerCase() === name.trim().toLowerCase())
}

export function formatSubagentCatalog(custom: ZyntheoSubagent[]): string {
	const rank: Record<ZyntheoSubagentSource, number> = { workspace: 0, user: 1, legacy: 2, builtin: 3 }
	const seen = new Set<string>()
	const lines: string[] = []
	for (const agent of [...custom, ...BUILTIN_SUBAGENTS].sort((a, b) => rank[a.source] - rank[b.source])) {
		const key = agent.name.toLowerCase()
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		lines.push(`- ${agent.name}: ${agent.description || 'No description.'}${agent.readonly ? ' (read-only)' : ''}`)
	}
	return lines.join('\n')
}

export function formatSubagentSystemSuffix(agent: ZyntheoSubagent): string {
	return `<zyntheo_subagent name="${agent.name}" mode="${agent.chatMode}" readonly="${agent.readonly}">
You are running as a subagent in your own chat tab. Stay scoped to the parent agent's task.
When finished, summarize results for the parent agent.

${agent.body}
</zyntheo_subagent>`
}

function clipAgentText(value: string): string {
	if (value.length <= MAX_SUBAGENT_PROMPT_CHARS) {
		return value
	}
	return `${value.slice(0, MAX_SUBAGENT_PROMPT_CHARS)}\n\n[truncated]`
}
