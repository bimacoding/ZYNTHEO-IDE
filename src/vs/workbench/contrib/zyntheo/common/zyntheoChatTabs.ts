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
	archived?: boolean
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

const MAX_VISIBLE_AGENT_TABS = 10

export function visibleAgentTabs(
	allThreads: Record<string, AgentTabThreadLike | undefined>,
	currentThreadId: string,
	runningThreadIds: string[] = [],
): AgentTabInfo[] {
	const running = new Set(runningThreadIds)
	const current = allThreads[currentThreadId]
	const familyRootId = current?.parentThreadId || currentThreadId

	const toInfo = (thread: AgentTabThreadLike): AgentTabInfo => {
		const isSubagent = thread.kind === 'subagent' || !!thread.parentThreadId
		return {
			id: thread.id,
			title: threadDisplayTitle(thread, isSubagent ? (thread.subagentName || 'Subagent') : 'New Agent'),
			kind: isSubagent ? 'subagent' : 'user',
			parentThreadId: thread.parentThreadId,
			subagentName: thread.subagentName,
			isEmpty: isEmptyAgentThread(thread),
		}
	}

	const shouldShow = (thread: AgentTabThreadLike) => {
		const isCurrent = thread.id === currentThreadId
		const isRunning = running.has(thread.id)
		const isSubagent = thread.kind === 'subagent' || !!thread.parentThreadId
		const inFamily = thread.id === familyRootId || thread.parentThreadId === familyRootId
		if (thread.archived && !isCurrent && !isRunning) {
			return false
		}
		if (isCurrent || isRunning) {
			return true
		}
		if (isSubagent) {
			return inFamily
		}
		// Keep empty user chats visible so "+" / "x" behave like browser tabs.
		return true
	}

	const shown = Object.values(allThreads)
		.filter((thread): thread is AgentTabThreadLike => !!thread && shouldShow(thread))
		.sort((a, b) => {
			if (a.id === currentThreadId) {
				return -1
			}
			if (b.id === currentThreadId) {
				return 1
			}
			const aFamily = a.id === familyRootId || a.parentThreadId === familyRootId
			const bFamily = b.id === familyRootId || b.parentThreadId === familyRootId
			if (aFamily !== bFamily) {
				return aFamily ? -1 : 1
			}
			return (b.lastModified || '').localeCompare(a.lastModified || '')
		})

	return shown.slice(0, MAX_VISIBLE_AGENT_TABS).map(toInfo)
}

export function nextTabIdAfterClose(tabs: { id: string }[], closedId: string): string | undefined {
	const idx = tabs.findIndex(tab => tab.id === closedId)
	if (idx < 0) {
		return tabs[0]?.id
	}
	return tabs[idx + 1]?.id || tabs[idx - 1]?.id
}
