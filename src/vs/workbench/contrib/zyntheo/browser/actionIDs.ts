// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const ZYNTHEO_CTRL_L_ACTION_ID = 'zyntheo.ctrlLAction'

export const ZYNTHEO_CTRL_K_ACTION_ID = 'zyntheo.ctrlKAction'

export const ZYNTHEO_ACCEPT_DIFF_ACTION_ID = 'zyntheo.acceptDiff'

export const ZYNTHEO_REJECT_DIFF_ACTION_ID = 'zyntheo.rejectDiff'

export const ZYNTHEO_GOTO_NEXT_DIFF_ACTION_ID = 'zyntheo.goToNextDiff'

export const ZYNTHEO_GOTO_PREV_DIFF_ACTION_ID = 'zyntheo.goToPrevDiff'

export const ZYNTHEO_GOTO_NEXT_URI_ACTION_ID = 'zyntheo.goToNextUri'

export const ZYNTHEO_GOTO_PREV_URI_ACTION_ID = 'zyntheo.goToPrevUri'

export const ZYNTHEO_ACCEPT_FILE_ACTION_ID = 'zyntheo.acceptFile'

export const ZYNTHEO_REJECT_FILE_ACTION_ID = 'zyntheo.rejectFile'

export const ZYNTHEO_ACCEPT_ALL_DIFFS_ACTION_ID = 'zyntheo.acceptAllDiffs'

export const ZYNTHEO_REJECT_ALL_DIFFS_ACTION_ID = 'zyntheo.rejectAllDiffs'
