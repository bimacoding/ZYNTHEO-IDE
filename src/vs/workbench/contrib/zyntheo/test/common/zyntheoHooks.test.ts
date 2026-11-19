/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	interpretHookOutput,
	mergeHooksConfigs,
	parseHooksConfig,
	selectMatchingHooks,
} from '../../common/zyntheoHooks.js';

suite('Zyntheo hooks', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('parses hooks.json and filters by matcher', () => {
		const config = parseHooksConfig(`{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "command": "python3 pre.py", "matcher": "edit_file|rewrite_file" },
      { "command": "python3 all.py" }
    ],
    "beforeSubmitPrompt": [
      { "command": "python3 prompt.py" }
    ]
  }
}`);
		assert.strictEqual(config.version, 1);
		assert.strictEqual(selectMatchingHooks(config, 'preToolUse', 'edit_file').length, 2);
		assert.strictEqual(selectMatchingHooks(config, 'preToolUse', 'read_file').length, 1);
		assert.strictEqual(selectMatchingHooks(config, 'beforeSubmitPrompt').length, 1);
	});

	test('workspace hooks overlay user hooks', () => {
		const user = parseHooksConfig(`{"hooks":{"stop":[{"command":"user-stop"}]}}`);
		const workspace = parseHooksConfig(`{"hooks":{"stop":[{"command":"workspace-stop"}]}}`);
		const merged = mergeHooksConfigs(user, workspace);
		assert.deepStrictEqual((merged.hooks.stop || []).map(h => h.command), ['user-stop', 'workspace-stop']);
	});

	test('JSON permission deny and exit code 2 block the action', () => {
		assert.strictEqual(interpretHookOutput({
			exitCode: 0,
			stdout: '{"permission":"deny","message":"blocked"}',
			stderr: '',
		}).permission, 'deny');
		assert.strictEqual(interpretHookOutput({
			exitCode: 2,
			stdout: '',
			stderr: 'policy',
		}).permission, 'deny');
		assert.strictEqual(interpretHookOutput({
			exitCode: 0,
			stdout: '{"permission":"allow"}',
			stderr: '',
		}).permission, 'allow');
	});
});
