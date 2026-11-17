/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import {
	ZYNTHEO_ACCEPT_ALL_DIFFS_ACTION_ID,
	ZYNTHEO_ACCEPT_DIFF_ACTION_ID,
	ZYNTHEO_ACCEPT_FILE_ACTION_ID,
	ZYNTHEO_CTRL_K_ACTION_ID,
	ZYNTHEO_CTRL_L_ACTION_ID,
	ZYNTHEO_GOTO_NEXT_DIFF_ACTION_ID,
	ZYNTHEO_GOTO_NEXT_URI_ACTION_ID,
	ZYNTHEO_GOTO_PREV_DIFF_ACTION_ID,
	ZYNTHEO_GOTO_PREV_URI_ACTION_ID,
	ZYNTHEO_REJECT_ALL_DIFFS_ACTION_ID,
	ZYNTHEO_REJECT_DIFF_ACTION_ID,
	ZYNTHEO_REJECT_FILE_ACTION_ID,
} from './actionIDs.js';

/**
 * Keep Void-era command IDs working so user keybindings.json entries do not break.
 */
const aliases: Array<[string, string]> = [
	['void.ctrlLAction', ZYNTHEO_CTRL_L_ACTION_ID],
	['void.ctrlKAction', ZYNTHEO_CTRL_K_ACTION_ID],
	['void.acceptDiff', ZYNTHEO_ACCEPT_DIFF_ACTION_ID],
	['void.rejectDiff', ZYNTHEO_REJECT_DIFF_ACTION_ID],
	['void.goToNextDiff', ZYNTHEO_GOTO_NEXT_DIFF_ACTION_ID],
	['void.goToPrevDiff', ZYNTHEO_GOTO_PREV_DIFF_ACTION_ID],
	['void.goToNextUri', ZYNTHEO_GOTO_NEXT_URI_ACTION_ID],
	['void.goToPrevUri', ZYNTHEO_GOTO_PREV_URI_ACTION_ID],
	['void.acceptFile', ZYNTHEO_ACCEPT_FILE_ACTION_ID],
	['void.rejectFile', ZYNTHEO_REJECT_FILE_ACTION_ID],
	['void.acceptAllDiffs', ZYNTHEO_ACCEPT_ALL_DIFFS_ACTION_ID],
	['void.rejectAllDiffs', ZYNTHEO_REJECT_ALL_DIFFS_ACTION_ID],
	['void.sidebar.open', 'zyntheo.sidebar.open'],
	['void.cmdShiftL', 'zyntheo.cmdShiftL'],
	['void.historyAction', 'zyntheo.historyAction'],
	['void.settingsAction', 'zyntheo.settingsAction'],
];

for (const [oldId, newId] of aliases) {
	CommandsRegistry.registerCommandAlias(oldId, newId);
}
