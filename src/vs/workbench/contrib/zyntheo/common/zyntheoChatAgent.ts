/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export const chatModeCycle = ['agent', 'plan', 'debug', 'multitask', 'ask'] as const
export type ChatAgentMode = typeof chatModeCycle[number]

export const MAX_QUEUED_CHAT_MESSAGES = 8

export type QueuedChatMessage = {
	id: string
	userMessage: string
}

export type SlashCommandKind = 'mode' | 'skill' | 'builtin'

export type SlashCommand = {
	id: string
	token: string
	label: string
	detail: string
	kind: SlashCommandKind
	mode?: ChatAgentMode
	defaultPrompt?: string
}

export type SkillLike = {
	name: string
	description?: string
}

const BUILTIN_SLASH_COMMANDS: SlashCommand[] = [
	{ id: 'mode:agent', token: 'agent', label: '/agent', detail: 'Edit files and run commands', kind: 'mode', mode: 'agent' },
	{ id: 'mode:plan', token: 'plan', label: '/plan', detail: 'Read-only: design an approach first', kind: 'mode', mode: 'plan' },
	{ id: 'mode:ask', token: 'ask', label: '/ask', detail: 'Answer questions without editing', kind: 'mode', mode: 'ask' },
	{ id: 'mode:debug', token: 'debug', label: '/debug', detail: 'Diagnose, then apply a targeted fix', kind: 'mode', mode: 'debug' },
	{ id: 'mode:multitask', token: 'multitask', label: '/multitask', detail: 'Start a parallel agent chat', kind: 'mode', mode: 'multitask' },
	{ id: 'builtin:review', token: 'review', label: '/review', detail: 'Review the latest changes in this chat', kind: 'builtin', defaultPrompt: 'Review the latest changes. List risks, missed tests, and remaining work.' },
	{ id: 'builtin:create-rule', token: 'create-rule', label: '/create-rule', detail: 'Add a project rule in .zyntheo/rules', kind: 'builtin', defaultPrompt: 'Create a focused project rule in .zyntheo/rules/. Use YAML frontmatter (description, alwaysApply or globs). Keep it short and actionable.' },
	{ id: 'builtin:create-skill', token: 'create-skill', label: '/create-skill', detail: 'Add a skill in .zyntheo/skills', kind: 'builtin', defaultPrompt: 'Create a project skill at .zyntheo/skills/<name>/SKILL.md with YAML frontmatter (name, description) and a short step-by-step body.' },
	{ id: 'builtin:create-subagent', token: 'create-subagent', label: '/create-subagent', detail: 'Add a subagent in .zyntheo/agents', kind: 'builtin', defaultPrompt: 'Create a custom subagent at .zyntheo/agents/<name>.md with YAML frontmatter (name, description, readonly) and a scoped system prompt.' },
	{ id: 'builtin:create-hook', token: 'create-hook', label: '/create-hook', detail: 'Add a hook in .zyntheo/hooks.json', kind: 'builtin', defaultPrompt: 'Add or update .zyntheo/hooks.json with a focused hook (beforeSubmitPrompt, preToolUse, postToolUse, or stop). Keep the command safe and documented.' },
]

export function normalizeChatAgentMode(value: unknown): ChatAgentMode {
	if (typeof value === 'string' && (chatModeCycle as readonly string[]).includes(value)) {
		return value as ChatAgentMode
	}
	return 'agent'
}

export function nextChatMode(current: unknown): ChatAgentMode {
	const mode = normalizeChatAgentMode(current)
	const index = chatModeCycle.indexOf(mode)
	return chatModeCycle[(index + 1) % chatModeCycle.length]
}

export function previousChatMode(current: unknown): ChatAgentMode {
	const mode = normalizeChatAgentMode(current)
	const index = chatModeCycle.indexOf(mode)
	return chatModeCycle[(index - 1 + chatModeCycle.length) % chatModeCycle.length]
}

export function enqueueChatMessage(queue: QueuedChatMessage[], item: QueuedChatMessage, max = MAX_QUEUED_CHAT_MESSAGES): QueuedChatMessage[] {
	return enqueueChatMessageAt(queue, item, 'end', max)
}

export function enqueueChatMessageAt(queue: QueuedChatMessage[], item: QueuedChatMessage, position: 'start' | 'end' = 'end', max = MAX_QUEUED_CHAT_MESSAGES): QueuedChatMessage[] {
	const text = item.userMessage.trim()
	if (!text) {
		return queue.slice()
	}
	const nextItem = { ...item, userMessage: text }
	const withoutDup = queue.filter(entry => entry.id !== item.id)
	const next = position === 'start' ? [nextItem, ...withoutDup] : [...withoutDup, nextItem]
	if (next.length <= max) {
		return next
	}
	return position === 'start' ? next.slice(0, max) : next.slice(-max)
}

export function takeNextQueuedMessage(queue: QueuedChatMessage[]): { next: QueuedChatMessage | undefined; remaining: QueuedChatMessage[] } {
	if (!queue.length) {
		return { next: undefined, remaining: [] }
	}
	return { next: queue[0], remaining: queue.slice(1) }
}

export function removeQueuedMessage(queue: QueuedChatMessage[], id: string): QueuedChatMessage[] {
	return queue.filter(entry => entry.id !== id)
}

export function moveQueuedMessage(queue: QueuedChatMessage[], id: string, direction: 'up' | 'down'): QueuedChatMessage[] {
	const index = queue.findIndex(entry => entry.id === id)
	if (index < 0) {
		return queue.slice()
	}
	const target = direction === 'up' ? index - 1 : index + 1
	if (target < 0 || target >= queue.length) {
		return queue.slice()
	}
	const next = queue.slice()
	const [item] = next.splice(index, 1)
	next.splice(target, 0, item)
	return next
}

export function parseLeadingSlash(text: string): { token: string; rest: string } | undefined {
	const match = text.match(/^\/([a-zA-Z0-9_-]*)(?:\s+([\s\S]*))?$/)
	if (!match) {
		return undefined
	}
	return { token: match[1] || '', rest: (match[2] || '').trim() }
}

export function shouldShowSlashMenu(text: string): boolean {
	if (!text.startsWith('/') || text.includes('\n')) {
		return false
	}
	const parsed = parseLeadingSlash(text)
	return !!parsed && parsed.rest === ''
}

export function slashCommandsForSkills(skills: SkillLike[]): SlashCommand[] {
	return skills
		.filter(skill => skill.name?.trim())
		.map(skill => ({
			id: `skill:${skill.name}`,
			token: skill.name,
			label: `/${skill.name}`,
			detail: skill.description?.trim() || 'Project skill',
			kind: 'skill' as const,
		}))
}

export function allSlashCommands(skills: SkillLike[] = []): SlashCommand[] {
	const seen = new Set<string>()
	const commands: SlashCommand[] = []
	for (const command of [...BUILTIN_SLASH_COMMANDS, ...slashCommandsForSkills(skills)]) {
		const key = command.token.toLowerCase()
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		commands.push(command)
	}
	return commands
}

export function matchSlashCommands(query: string, skills: SkillLike[] = []): SlashCommand[] {
	const parsed = parseLeadingSlash(query)
	if (!parsed) {
		return []
	}
	const needle = parsed.token.toLowerCase()
	return allSlashCommands(skills).filter(command => command.token.toLowerCase().startsWith(needle)).slice(0, 12)
}

export function applySlashCommand(text: string, command: SlashCommand): { text: string; mode?: ChatAgentMode } {
	const parsed = parseLeadingSlash(text)
	const rest = parsed?.rest || ''
	if (command.kind === 'mode' && command.mode) {
		return { text: rest, mode: command.mode }
	}
	if (command.kind === 'builtin') {
		return { text: rest || command.defaultPrompt || '' }
	}
	const prefix = `/${command.token}`
	return { text: rest ? `${prefix} ${rest}` : `${prefix} ` }
}

export function planBuildPrompt(): string {
	return 'Implement the approved plan above. Stay scoped to that plan, make the smallest correct changes, and verify.'
}

export function followUpSuggestions(opts: { mode: ChatAgentMode | string; lastAssistant?: string; lastUser?: string }): string[] {
	const mode = normalizeChatAgentMode(opts.mode)
	if (mode === 'plan') {
		return ['Build this plan', 'Explore the riskiest files first', 'Split this into parallel tasks']
	}
	if (mode === 'ask') {
		return ['How would we implement this?', 'Show the relevant files', 'Turn this into a plan']
	}
	if (mode === 'debug') {
		return ['Add a regression test', 'Check related call sites', 'Explain the root cause more']
	}
	if (mode === 'multitask') {
		return ['Continue the next parallel task', 'Summarize all worker results', 'Review combined diffs']
	}
	return ['Review the changes', 'Write tests for this', 'Commit these changes']
}

export function summarizeSubagentThread(messages: { role: string; displayContent?: string; content?: string }[] | undefined): string {
	const list = messages || []
	const lastAssistant = [...list].reverse().find(message => message.role === 'assistant')
	const text = (lastAssistant?.displayContent || lastAssistant?.content || '').trim()
	if (text) {
		return text.replace(/\s+/g, ' ').slice(0, 1200)
	}
	const lastTool = [...list].reverse().find(message => message.role === 'tool')
	if (lastTool?.content) {
		return String(lastTool.content).replace(/\s+/g, ' ').slice(0, 600)
	}
	return 'Subagent finished without a summary.'
}

export function isArchivedThread(thread: { archived?: boolean } | undefined): boolean {
	return thread?.archived === true
}
