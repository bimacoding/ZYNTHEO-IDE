/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { mergeMCPConfigFiles } from '../../common/mcpServiceTypes.js';

suite('Zyntheo MCP workspace merge', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('workspace mcp.json overrides user servers of the same name', () => {
		const merged = mergeMCPConfigFiles([
			{ mcpServers: { filesystem: { command: 'user-fs' }, github: { command: 'user-gh' } } },
			{ mcpServers: { filesystem: { command: 'workspace-fs' } } },
		]);
		assert.strictEqual(merged.mcpServers.filesystem?.command, 'workspace-fs');
		assert.strictEqual(merged.mcpServers.github?.command, 'user-gh');
	});
});
