/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { threadDisplayTitle, visibleAgentTabs } from '../../common/zyntheoChatTabs.js';

suite('Zyntheo chat agent tabs', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('shows current thread, recent chats, running subagent, and hides empty unused threads', () => {
		const tabs = visibleAgentTabs({
			parent: {
				id: 'parent',
				title: 'Full rebranding and launch',
				kind: 'user',
				lastModified: '2026-01-04',
				messages: [{ role: 'user', displayContent: 'Full rebranding and launch' }],
			},
			child: {
				id: 'child',
				kind: 'subagent',
				parentThreadId: 'parent',
				subagentName: 'explore',
				lastModified: '2026-01-05',
				messages: [],
			},
			empty: {
				id: 'empty',
				kind: 'user',
				lastModified: '2026-01-01',
				messages: [],
			},
			recent: {
				id: 'recent',
				kind: 'user',
				title: 'Diagnose and start Traefik',
				lastModified: '2026-01-03',
				messages: [{ role: 'user', displayContent: 'Diagnose and start Traefik' }],
			},
		}, 'parent', ['child']);

		assert.deepStrictEqual(tabs.map(tab => `${tab.kind}:${tab.title}`), [
			'user:Full rebranding and launch',
			'subagent:explore',
			'user:Diagnose and start Traefik',
		]);
	});

	test('falls back to first user message for untitled threads', () => {
		assert.strictEqual(threadDisplayTitle({
			id: 'a',
			messages: [{ role: 'user', displayContent: 'Plan, Build, / for skills' }],
		}), 'Plan, Build, / for skills');
	});
});
