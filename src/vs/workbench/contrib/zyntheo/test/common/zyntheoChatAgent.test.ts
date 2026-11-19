/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applySlashCommand, enqueueChatMessage, enqueueChatMessageAt, followUpSuggestions, matchSlashCommands, moveQueuedMessage, nextChatMode, parseLeadingSlash, planBuildPrompt, shouldShowSlashMenu, summarizeSubagentThread, takeNextQueuedMessage } from '../../common/zyntheoChatAgent.js';
import { visibleAgentTabs } from '../../common/zyntheoChatTabs.js';

suite('Zyntheo Cursor-like chat agent', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('queues follow-up messages and drains FIFO', () => {
		const queued = enqueueChatMessage([], { id: 'a', userMessage: ' first ' });
		const withSecond = enqueueChatMessage(queued, { id: 'b', userMessage: 'second' });
		const taken = takeNextQueuedMessage(withSecond);
		assert.strictEqual(taken.next?.userMessage, 'first');
		assert.deepStrictEqual(taken.remaining.map(item => item.id), ['b']);
	});

	test('Cmd+Enter queues next and reorder moves items', () => {
		const queued = enqueueChatMessage([], { id: 'a', userMessage: 'later' });
		const sendNow = enqueueChatMessageAt(queued, { id: 'b', userMessage: 'now' }, 'start');
		assert.deepStrictEqual(sendNow.map(item => item.id), ['b', 'a']);
		const moved = moveQueuedMessage(sendNow, 'a', 'up');
		assert.deepStrictEqual(moved.map(item => item.id), ['a', 'b']);
	});

	test('slash menu matches modes and skills', () => {
		assert.ok(shouldShowSlashMenu('/pl'));
		assert.ok(!shouldShowSlashMenu('hello /plan'));
		const hits = matchSlashCommands('/pl', [{ name: 'plan-helper', description: 'Plan helper' }]);
		assert.ok(hits.some(hit => hit.token === 'plan'));
		const applied = applySlashCommand('/plan', hits.find(hit => hit.token === 'plan')!);
		assert.strictEqual(applied.mode, 'plan');
		assert.strictEqual(applied.text, '');
		const withRest = applySlashCommand('/plan implement auth', hits.find(hit => hit.token === 'plan')!);
		assert.strictEqual(withRest.mode, 'plan');
		assert.strictEqual(withRest.text, 'implement auth');
	});

	test('slash skill keeps the token in the prompt', () => {
		const [skill] = matchSlashCommands('/commit-helper', [{ name: 'commit-helper', description: 'Commit messages' }]);
		const applied = applySlashCommand('/commit-helper', skill);
		assert.ok(applied.text.startsWith('/commit-helper'));
		assert.strictEqual(parseLeadingSlash('/commit-helper fix tests')?.rest, 'fix tests');
	});

	test('slash create-rule expands to a default prompt', () => {
		const hits = matchSlashCommands('/create');
		assert.ok(hits.some(hit => hit.token === 'create-rule'));
		const applied = applySlashCommand('/create-rule', hits.find(hit => hit.token === 'create-rule')!);
		assert.ok(applied.text.includes('.zyntheo/rules'));
	});

	test('Shift+Tab cycles chat modes', () => {
		assert.strictEqual(nextChatMode('agent'), 'plan');
		assert.strictEqual(nextChatMode('ask'), 'agent');
	});

	test('plan follow-ups include Build and archived tabs stay in history only', () => {
		assert.ok(planBuildPrompt().includes('Implement the approved plan'));
		assert.ok(followUpSuggestions({ mode: 'plan' }).includes('Build this plan'));
		const tabs = visibleAgentTabs({
			open: { id: 'open', title: 'Open chat', messages: [{ role: 'user', displayContent: 'hi' }] },
			old: { id: 'old', title: 'Archived chat', archived: true, messages: [{ role: 'user', displayContent: 'old' }] },
		}, 'open');
		assert.deepStrictEqual(tabs.map(tab => tab.id), ['open']);
	});

	test('subagent summary prefers the last assistant message', () => {
		assert.strictEqual(summarizeSubagentThread([
			{ role: 'user', displayContent: 'look around' },
			{ role: 'assistant', displayContent: 'Found the routing bug in traefik.ts' },
		]), 'Found the routing bug in traefik.ts');
	});
});
