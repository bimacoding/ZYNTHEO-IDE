/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	clampBrowserBounds,
	DEFAULT_BROWSER_URL,
	emptyBrowserState,
	formatInspectResult,
	formatZoomPercent,
	looksLikeHost,
	looksLikeLocalAddress,
	nextZoomFactor,
	normalizeBrowserUrl,
	titleFromUrl,
} from '../../common/zyntheoBrowser.js';

suite('Zyntheo embedded browser helpers', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('normalizes search, host, and localhost URLs', () => {
		assert.strictEqual(normalizeBrowserUrl(''), DEFAULT_BROWSER_URL);
		assert.strictEqual(normalizeBrowserUrl('https://example.com/app'), 'https://example.com/app');
		assert.strictEqual(normalizeBrowserUrl('localhost:3000'), 'http://localhost:3000');
		assert.strictEqual(normalizeBrowserUrl('http://localhost:5173'), 'http://localhost:5173');
		assert.strictEqual(normalizeBrowserUrl('127.0.0.1:5173/docs'), 'http://127.0.0.1:5173/docs');
		assert.strictEqual(normalizeBrowserUrl('example.com'), 'https://example.com');
		assert.ok(normalizeBrowserUrl('server requirements').includes('google.com/search?q='));
	});

	test('detects local addresses and hosts', () => {
		assert.strictEqual(looksLikeLocalAddress('localhost:3000'), true);
		assert.strictEqual(looksLikeLocalAddress('127.0.0.1'), true);
		assert.strictEqual(looksLikeHost('cursor.com'), true);
		assert.strictEqual(looksLikeHost('not a host'), false);
	});

	test('formats titles and zoom steps like Cursor toolbar', () => {
		assert.strictEqual(titleFromUrl('https://www.cursor.com/docs'), 'cursor.com');
		assert.strictEqual(formatZoomPercent(1), '100%');
		assert.strictEqual(nextZoomFactor(1, 1), 1.1);
		assert.strictEqual(nextZoomFactor(1, -1), 0.9);
		assert.strictEqual(nextZoomFactor(1.05, 0), 1);
	});

	test('clamps overlay bounds used by BrowserView', () => {
		assert.deepStrictEqual(clampBrowserBounds({ x: 10.4, y: 20.6, width: 800.2, height: 600.8 }), {
			x: 10,
			y: 21,
			width: 800,
			height: 601,
		});
		assert.strictEqual(clampBrowserBounds({ x: 0, y: 0, width: 0, height: 40 }), undefined);
	});

	test('creates an empty browser state for a new tab', () => {
		const state = emptyBrowserState('view-1', 'http://localhost:3000');
		assert.strictEqual(state.viewId, 'view-1');
		assert.strictEqual(state.inspecting, false);
		assert.strictEqual(state.canGoBack, false);
		assert.strictEqual(state.zoomFactor, 1);
		assert.strictEqual(state.title, 'localhost');
	});

	test('formats inspected DOM elements for chat like Cursor Select Element', () => {
		const snippet = formatInspectResult({
			viewId: 'view-1',
			url: 'http://localhost:3000/docs',
			tagName: 'button',
			selector: 'nav > button.primary',
			outerHTML: '<button class="primary">Open Console</button>',
			innerText: 'Open Console',
			computedStyle: {
				display: 'flex',
				color: 'rgb(255, 255, 255)',
				background: '',
			},
		});
		assert.ok(snippet.includes('Selected DOM element from http://localhost:3000/docs'));
		assert.ok(snippet.includes('Selector: nav > button.primary'));
		assert.ok(snippet.includes('Text: Open Console'));
		assert.ok(snippet.includes('display: flex;'));
		assert.ok(!snippet.includes('background:'));
		assert.ok(snippet.includes('```html'));
		assert.ok(snippet.includes('<button class="primary">Open Console</button>'));
	});
});
