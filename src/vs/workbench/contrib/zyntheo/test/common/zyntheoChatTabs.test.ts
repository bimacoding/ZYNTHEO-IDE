/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { threadDisplayTitle, visibleAgentTabs } from '../../common/zyntheoChatTabs.js';

suite('Zyntheo chat agent tabs', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('shows current thread, running subagent, and hides empty unused threads', () => {
		const tabs = visibleAgentTabs({
			parent: {
				id: 'parent',
				title: 'Server requirements',
				kind: 'user',
				lastModified: '2026-01-02',
				messages: [{ role: 'user', displayContent: 'Check server requirements' }],
			},
			child: {
				id: 'child',
				kind: 'subagent',
				parentThreadId: 'parent',
				subagentName: 'explore',
				lastModified: '2026-01-03',
				messages: [],
			},
			empty: {
				id: 'empty',
				kind: 'user',
				lastModified: '2026-01-01',
				messages: [],
			},
			old: {
				id: 'old',
				kind: 'user',
				title: 'Old chat',
				lastModified: '2025-12-01',
				messages: [{ role: 'user', displayContent: 'history' }],
			},
		}, 'parent', ['child']);

		assert.deepStrictEqual(tabs.map(tab => `${tab.kind}:${tab.title}`), [
			'user:Server requirements',
			'subagent:explore',
		]);
	});

	test('falls back to first user message for untitled threads', () => {
		assert.strictEqual(threadDisplayTitle({
			id: 'a',
			messages: [{ role: 'user', displayContent: 'Plan, Build, / for skills' }],
		}), 'Plan, Build, / for skills');
	});
});
