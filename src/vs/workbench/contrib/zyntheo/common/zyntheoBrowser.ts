/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export const ZYNTHEO_BROWSER_CHANNEL_NAME = 'zyntheo-channel-browser';
export const ZYNTHEO_BROWSER_SCHEME = 'zyntheo-browser';
export const DEFAULT_BROWSER_URL = 'https://www.google.com';
export const BROWSER_ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export type ZyntheoBrowserBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type ZyntheoBrowserViewState = {
	viewId: string;
	url: string;
	title: string;
	loading: boolean;
	canGoBack: boolean;
	canGoForward: boolean;
	zoomFactor: number;
	inspecting: boolean;
	error?: string;
};

export type ZyntheoBrowserScreenshot = {
	dataBase64: string;
	mimeType: 'image/png';
	name: string;
};

export type ZyntheoBrowserInspectResult = {
	viewId: string;
	url: string;
	tagName: string;
	selector: string;
	outerHTML: string;
	innerText?: string;
	computedStyle?: Record<string, string>;
};

export function looksLikeLocalAddress(value: string): boolean {
	return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(value)
		|| /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(value);
}

export function looksLikeHost(value: string): boolean {
	if (looksLikeLocalAddress(value)) {
		return true;
	}
	if (/^[\w.-]+:\d+(\/|$)/.test(value)) {
		return true;
	}
	return /^[\w.-]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(value);
}

export function normalizeBrowserUrl(input: string | undefined | null): string {
	const raw = (input ?? '').trim();
	if (!raw) {
		return DEFAULT_BROWSER_URL;
	}
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) || /^(about|data|javascript|file|blob):/i.test(raw)) {
		return raw;
	}
	if (looksLikeLocalAddress(raw)) {
		return `http://${raw}`;
	}
	if (looksLikeHost(raw)) {
		return `https://${raw}`;
	}
	return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
}

export function titleFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		return (parsed.hostname || parsed.host || url).replace(/^www\./, '') || url;
	} catch {
		return url;
	}
}

export function nextZoomFactor(current: number, direction: 1 | -1 | 0): number {
	if (direction === 0) {
		return 1;
	}
	const epsilon = 0.001;
	if (direction > 0) {
		const next = BROWSER_ZOOM_STEPS.find(step => step > current + epsilon);
		return next ?? BROWSER_ZOOM_STEPS[BROWSER_ZOOM_STEPS.length - 1];
	}
	for (let i = BROWSER_ZOOM_STEPS.length - 1; i >= 0; i--) {
		if (BROWSER_ZOOM_STEPS[i] < current - epsilon) {
			return BROWSER_ZOOM_STEPS[i];
		}
	}
	return BROWSER_ZOOM_STEPS[0];
}

export function formatZoomPercent(factor: number): string {
	return `${Math.round(factor * 100)}%`;
}

export function clampBrowserBounds(bounds: ZyntheoBrowserBounds): ZyntheoBrowserBounds | undefined {
	const x = Math.round(bounds.x);
	const y = Math.round(bounds.y);
	const width = Math.round(bounds.width);
	const height = Math.round(bounds.height);
	if (width < 8 || height < 8) {
		return undefined;
	}
	return { x, y, width, height };
}

export function emptyBrowserState(viewId: string, url = DEFAULT_BROWSER_URL): ZyntheoBrowserViewState {
	return {
		viewId,
		url,
		title: titleFromUrl(url),
		loading: false,
		canGoBack: false,
		canGoForward: false,
		zoomFactor: 1,
		inspecting: false,
	};
}

export function formatInspectResult(result: ZyntheoBrowserInspectResult): string {
	const styleLines = Object.entries(result.computedStyle ?? {})
		.filter(([, value]) => !!value)
		.map(([key, value]) => `  ${key}: ${value};`)
		.join('\n');
	return [
		`Selected DOM element from ${result.url}`,
		`Selector: ${result.selector || result.tagName}`,
		result.innerText ? `Text: ${result.innerText}` : undefined,
		styleLines ? `Computed style:\n${styleLines}` : undefined,
		result.outerHTML ? `HTML:\n\`\`\`html\n${result.outerHTML}\n\`\`\`` : undefined,
	].filter(Boolean).join('\n\n');
}
