/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type AgentTabKind = 'user' | 'subagent'

export type AgentTabThreadLike = {
	id: string
	title?: string
	kind?: AgentTabKind
	subagentName?: string
	parentThreadId?: string
	lastModified?: string
	messages?: { role: string; displayContent?: string; content?: string }[]
}

export type AgentTabInfo = {
	id: string
	title: string
	kind: AgentTabKind
	parentThreadId?: string
	subagentName?: string
	isEmpty: boolean
}

export function firstUserMessageText(thread: AgentTabThreadLike | undefined): string {
	const messages = thread?.messages || []
	const user = messages.find(message => message.role === 'user')
	const text = (user?.displayContent || user?.content || '').trim()
	return text
}

export function threadDisplayTitle(thread: AgentTabThreadLike | undefined, fallback = 'New Agent'): string {
	if (!thread) {
		return fallback
	}
	if (thread.title?.trim()) {
		return thread.title.trim()
	}
	if (thread.subagentName?.trim()) {
		return thread.subagentName.trim()
	}
	const first = firstUserMessageText(thread)
	if (first) {
		return first.replace(/\s+/g, ' ').slice(0, 36)
	}
	return fallback
}

export function isEmptyAgentThread(thread: AgentTabThreadLike | undefined): boolean {
	return !thread?.messages?.some(message => message.role === 'user' || message.role === 'assistant')
}

export function visibleAgentTabs(
	allThreads: Record<string, AgentTabThreadLike | undefined>,
	currentThreadId: string,
	runningThreadIds: string[] = [],
): AgentTabInfo[] {
	const running = new Set(runningThreadIds)
	const tabs: AgentTabInfo[] = []
	const seen = new Set<string>()

	const current = allThreads[currentThreadId]
	const familyRootId = current?.parentThreadId || currentThreadId

	const consider = (thread: AgentTabThreadLike | undefined) => {
		if (!thread || seen.has(thread.id)) {
			return
		}
		const empty = isEmptyAgentThread(thread)
		const isCurrent = thread.id === currentThreadId
		const isRunning = running.has(thread.id)
		const isSubagent = thread.kind === 'subagent' || !!thread.parentThreadId
		const inFamily = thread.id === familyRootId || thread.parentThreadId === familyRootId
		if (!isCurrent && !isRunning && !inFamily) {
			return
		}
		if (!isCurrent && empty && !isRunning && !isSubagent) {
			return
		}
		seen.add(thread.id)
		tabs.push({
			id: thread.id,
			title: threadDisplayTitle(thread, isSubagent ? (thread.subagentName || 'Subagent') : 'New Agent'),
			kind: isSubagent ? 'subagent' : 'user',
			parentThreadId: thread.parentThreadId,
			subagentName: thread.subagentName,
			isEmpty: empty,
		})
	}

	consider(allThreads[currentThreadId])
	const rest = Object.values(allThreads)
		.filter((thread): thread is AgentTabThreadLike => !!thread)
		.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''))
	for (const thread of rest) {
		consider(thread)
	}
	return tabs
}
