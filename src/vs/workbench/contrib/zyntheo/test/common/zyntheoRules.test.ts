/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	formatAlwaysApplyInstructions,
	formatRulesAndSkillsForPrompt,
	parseFrontmatter,
	parseRuleDocument,
	parseSkillDocument,
	pathMatchesGlob,
	ruleApplies,
	selectActiveRules,
	selectExpandedSkills,
	skillShouldExpand,
} from '../../common/zyntheoRules.js';

suite('Zyntheo rules and skills', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('parses YAML frontmatter, globs, and alwaysApply', () => {
		const { frontmatter, body } = parseFrontmatter(`---
description: TypeScript conventions
globs:
  - "**/*.ts"
  - "**/*.tsx"
alwaysApply: false
---

# TypeScript
Use strict types.
`);
		assert.strictEqual(frontmatter.description, 'TypeScript conventions');
		assert.deepStrictEqual(frontmatter.globs, ['**/*.ts', '**/*.tsx']);
		assert.strictEqual(frontmatter.alwaysApply, false);
		assert.ok(body.includes('Use strict types.'));
	});

	test('treats rules without globs or description as always-apply', () => {
		const rule = parseRuleDocument({
			path: '/proj/.zyntheo/rules/style.md',
			content: '# Style\nNever add semicolons.',
			source: 'workspace',
		});
		assert.strictEqual(rule.alwaysApply, true);
		assert.strictEqual(ruleApplies(rule, {}), true);
	});

	test('matches glob rules against open files', () => {
		assert.strictEqual(pathMatchesGlob('src/app.ts', '**/*.ts'), true);
		assert.strictEqual(pathMatchesGlob('/Users/me/proj/src/app.tsx', '*.tsx'), true);
		assert.strictEqual(pathMatchesGlob('src/app.py', '**/*.{ts,tsx}'), false);

		const rule = parseRuleDocument({
			path: '/proj/.zyntheo/rules/typescript.mdc',
			content: `---
description: TS only
globs: "**/*.ts"
alwaysApply: false
---
Prefer interfaces.
`,
			source: 'workspace',
		});
		assert.strictEqual(ruleApplies(rule, { openedPaths: ['README.md'] }), false);
		assert.strictEqual(ruleApplies(rule, { activePath: 'src/index.ts' }), true);
	});

	test('expands skills by name or relevant query, and respects disable-model-invocation', () => {
		const review = parseSkillDocument({
			path: '/proj/.zyntheo/skills/code-review/SKILL.md',
			content: `---
name: code-review
description: Review code for quality, security, and maintainability. Use when reviewing pull requests or code changes.
---
Review checklist here.
`,
			source: 'workspace',
		});
		const manual = parseSkillDocument({
			path: '/proj/.zyntheo/skills/manual-only/SKILL.md',
			content: `---
name: manual-only
description: Only load when named
disable-model-invocation: true
---
Secret workflow.
`,
			source: 'user',
		});

		assert.strictEqual(skillShouldExpand(review, { userQuery: 'please review this pull request for security' }), true);
		assert.strictEqual(skillShouldExpand(manual, { userQuery: 'please review this pull request' }), false);
		assert.strictEqual(skillShouldExpand(manual, { userQuery: 'use the manual-only skill now' }), true);
		assert.deepStrictEqual(selectExpandedSkills([review, manual], { userQuery: 'code review the PR' }).map(s => s.name), ['code-review']);
	});

	test('injects active rules and matching skills into the prompt', () => {
		const always = parseRuleDocument({
			path: '/proj/.zyntheo/rules/project.mdc',
			content: `---
description: Always follow team language
alwaysApply: true
---
Respond in Indonesian when the user writes Indonesian.
`,
			source: 'workspace',
		});
		const globRule = parseRuleDocument({
			path: '/proj/.zyntheo/rules/python.mdc',
			content: `---
description: Python conventions
globs: "**/*.py"
alwaysApply: false
---
Use type hints.
`,
			source: 'workspace',
		});
		const skill = parseSkillDocument({
			path: '/proj/.zyntheo/skills/commit-helper/SKILL.md',
			content: `---
name: commit-helper
description: Generate descriptive commit messages from git diffs. Use when writing commit messages.
---
Use conventional commits.
`,
			source: 'workspace',
		});

		const prompt = formatRulesAndSkillsForPrompt({
			rules: [always, globRule],
			skills: [skill],
			context: {
				activePath: 'src/main.ts',
				userQuery: 'tolong buatkan commit message',
			},
		});

		assert.ok(prompt.includes('<zyntheo_rules>'));
		assert.ok(prompt.includes('Respond in Indonesian'));
		assert.ok(!prompt.includes('Use type hints.'));
		assert.ok(prompt.includes('<zyntheo_skills>'));
		assert.ok(prompt.includes('commit-helper'));
		assert.ok(prompt.includes('<zyntheo_active_skills>'));
		assert.ok(prompt.includes('Use conventional commits.'));
		assert.ok(formatAlwaysApplyInstructions([always, globRule]).includes('Respond in Indonesian'));
		assert.strictEqual(selectActiveRules([always, globRule], { activePath: 'src/main.ts' }).length, 1);
	});

	test('composed agent prompt includes loaded rules and matching skills', () => {
		const instructions = formatRulesAndSkillsForPrompt({
			rules: [parseRuleDocument({
				path: '/proj/.zyntheo/rules/core.mdc',
				content: `---
alwaysApply: true
---
Never delete comments.
`,
				source: 'workspace',
			})],
			skills: [parseSkillDocument({
				path: '/proj/.zyntheo/skills/debug-logs/SKILL.md',
				content: `---
name: debug-logs
description: Inspect logs when debugging runtime errors.
---
Start from the stack trace.
`,
				source: 'workspace',
			})],
			context: { userQuery: 'debug these runtime logs please' },
		});

		const composed = [
			'Follow project rules in `.zyntheo/rules` (and user rules in `~/.zyntheo/rules`). When a listed skill is relevant, read and follow `.zyntheo/skills/<name>/SKILL.md`.',
			instructions,
		].join('\n\n');

		assert.ok(composed.includes('.zyntheo/rules'));
		assert.ok(composed.includes('.zyntheo/skills'));
		assert.ok(composed.includes('Never delete comments.'));
		assert.ok(composed.includes('debug-logs'));
		assert.ok(composed.includes('Start from the stack trace.'));
	});
});
