/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Current Zyntheo keys
export const ZYNTHEO_SETTINGS_STORAGE_KEY = 'zyntheo.settingsServiceStorageII'
export const THREAD_STORAGE_KEY = 'zyntheo.chatThreadStorageII'
export const OPT_OUT_KEY = 'zyntheo.app.optOutAll'

// Legacy Void keys — read fallback only; new writes use Zyntheo keys
export const LEGACY_VOID_SETTINGS_STORAGE_KEY = 'void.settingsServiceStorageII'
export const LEGACY_VOID_THREAD_STORAGE_KEY = 'void.chatThreadStorageII'
export const LEGACY_VOID_OPT_OUT_KEY = 'void.app.optOutAll'

/** Read storage value preferring the new key, falling back to legacy Void key. */
export function readWithVoidFallback(
	get: (key: string) => string | undefined,
	newKey: string,
	legacyKey: string,
): string | undefined {
	return get(newKey) ?? get(legacyKey)
}
