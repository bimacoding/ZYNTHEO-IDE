/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	BUILTIN_SUBAGENTS,
	formatSubagentCatalog,
	formatSubagentSystemSuffix,
	parseAgentDocument,
	resolveSubagent,
} from '../../common/zyntheoAgents.js';

suite('Zyntheo subagents', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('parses custom agent markdown with frontmatter', () => {
		const agent = parseAgentDocument({
			path: '/proj/.zyntheo/agents/explorer.md',
			source: 'workspace',
			content: `---
name: explorer
description: Read-only explorer
readonly: true
chatMode: ask
---

Stay scoped. Prefer search tools.
`,
		});
		assert.strictEqual(agent.name, 'explorer');
		assert.strictEqual(agent.readonly, true);
		assert.strictEqual(agent.chatMode, 'ask');
		assert.ok(agent.body.includes('Stay scoped'));
	});

	test('workspace custom agent overrides builtin of the same name', () => {
		const custom = parseAgentDocument({
			path: '/proj/.zyntheo/agents/explore.md',
			source: 'workspace',
			content: `---
name: explore
description: Project explorer override
readonly: true
---
Custom explore body.
`,
		});
		const resolved = resolveSubagent('explore', [custom]);
		assert.ok(resolved);
		assert.strictEqual(resolved?.source, 'workspace');
		assert.ok(resolved?.body.includes('Custom explore body'));
	});

	test('catalog lists builtins and custom names without duplicates', () => {
		const custom = parseAgentDocument({
			path: '/proj/.zyntheo/agents/reviewer.md',
			source: 'workspace',
			content: `---
name: reviewer
description: Reviews diffs
---
Review carefully.
`,
		});
		const catalog = formatSubagentCatalog([custom]);
		assert.ok(catalog.includes('- reviewer:'));
		assert.ok(catalog.includes('- explore:'));
		assert.ok(catalog.includes('- generalPurpose:'));
		assert.strictEqual(BUILTIN_SUBAGENTS.length, 4);
	});

	test('system suffix wraps subagent instructions', () => {
		const suffix = formatSubagentSystemSuffix(BUILTIN_SUBAGENTS[0]);
		assert.ok(suffix.includes('<zyntheo_subagent name="explore"'));
		assert.ok(suffix.includes('readonly="true"'));
		assert.ok(suffix.includes('own chat tab'));
	});
});
