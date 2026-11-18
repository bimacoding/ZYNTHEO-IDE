/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { StagingSelectionItem } from './chatThreadServiceTypes.js';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_TEXT_ATTACHMENT_CHARS = 200_000;
export const ZYNTHEO_IMAGE_SCHEME = 'zyntheo-image';

export const IMAGE_EXTENSIONS = new Set([
	'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif', 'heic', 'heif', 'tif', 'tiff',
]);

const MIME_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	svg: 'image/svg+xml',
	avif: 'image/avif',
	heic: 'image/heic',
	heif: 'image/heif',
	tif: 'image/tiff',
	tiff: 'image/tiff',
	pdf: 'application/pdf',
	txt: 'text/plain',
	md: 'text/markdown',
	json: 'application/json',
	csv: 'text/csv',
};

export type ChatImageAttachment = {
	name: string;
	mimeType: string;
	dataBase64: string;
};

export type OpenAIImagePart = {
	type: 'image_url';
	image_url: { url: string };
};

export type OpenAITextPart = {
	type: 'text';
	text: string;
};

export type AnthropicImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export type AnthropicImagePart = {
	type: 'image';
	source: {
		type: 'base64';
		media_type: AnthropicImageMediaType;
		data: string;
	};
};

export type AnthropicTextPart = {
	type: 'text';
	text: string;
};

export type GeminiInlineDataPart = {
	inlineData: {
		mimeType: string;
		data: string;
	};
};

export type LLMImageFormat = 'openai' | 'anthropic';

export function getFileExtension(nameOrPath: string): string {
	const normalized = nameOrPath.replace(/\\/g, '/');
	const base = normalized.split('/').pop() ?? normalized;
	const dot = base.lastIndexOf('.');
	if (dot <= 0 || dot === base.length - 1) {
		return '';
	}
	return base.slice(dot + 1).toLowerCase();
}

export function isImageFileName(nameOrPath: string): boolean {
	return IMAGE_EXTENSIONS.has(getFileExtension(nameOrPath));
}

export function isImageMimeType(mimeType: string | undefined | null): boolean {
	if (!mimeType) {
		return false;
	}
	return mimeType.toLowerCase().startsWith('image/');
}

export function guessMimeType(nameOrPath: string, fallback = 'application/octet-stream'): string {
	const ext = getFileExtension(nameOrPath);
	return MIME_BY_EXT[ext] || fallback;
}

export function isProbablyBinaryString(val: string | null | undefined): boolean {
	if (!val) {
		return false;
	}
	if (val.includes('\u0000')) {
		return true;
	}
	const sample = val.slice(0, 8000);
	if (!sample) {
		return false;
	}
	let nonPrintable = 0;
	for (let i = 0; i < sample.length; i++) {
		const code = sample.charCodeAt(i);
		if (code === 9 || code === 10 || code === 13) {
			continue;
		}
		if (code < 32 || code === 0xFFFD) {
			nonPrintable++;
		}
	}
	return nonPrintable / sample.length > 0.3;
}

export function encodeBytesToBase64(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64');
	}
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

export function createImageStagingSelection(opts: {
	name: string;
	mimeType: string;
	dataBase64: string;
	uri?: URI;
}): StagingSelectionItem {
	const pathName = opts.name.replace(/\\/g, '/').split('/').pop() || 'image';
	return {
		type: 'Image',
		uri: opts.uri ?? URI.from({ scheme: ZYNTHEO_IMAGE_SCHEME, path: `/${Date.now()}-${pathName}` }),
		name: pathName,
		mimeType: opts.mimeType || guessMimeType(pathName, 'image/png'),
		dataBase64: opts.dataBase64,
	};
}

export function isImageStagingSelection(selection: StagingSelectionItem | undefined | null): selection is StagingSelectionItem & { type: 'Image' } {
	return selection?.type === 'Image';
}

export function describeImageForPrompt(name: string, mimeType: string): string {
	return `Image attachment "${name}" (${mimeType}): visual content is attached for models that support images.`;
}

export function describeBinaryFileForPrompt(pathStr: string, byteHint?: number): string {
	const size = typeof byteHint === 'number' ? `, ~${byteHint} bytes` : '';
	return `${pathStr}: [binary file${size}; contents omitted]`;
}

export function toOpenAIImagePart(image: ChatImageAttachment): OpenAIImagePart {
	const mime = image.mimeType || 'image/png';
	return {
		type: 'image_url',
		image_url: {
			url: `data:${mime};base64,${image.dataBase64}`,
		},
	};
}

export function toAnthropicMediaType(mimeType: string | undefined | null): AnthropicImageMediaType {
	const mime = (mimeType || 'image/png').toLowerCase();
	if (mime === 'image/jpeg' || mime === 'image/jpg') {
		return 'image/jpeg';
	}
	if (mime === 'image/gif') {
		return 'image/gif';
	}
	if (mime === 'image/webp') {
		return 'image/webp';
	}
	return 'image/png';
}

export function toAnthropicImagePart(image: ChatImageAttachment): AnthropicImagePart {
	return {
		type: 'image',
		source: {
			type: 'base64',
			media_type: toAnthropicMediaType(image.mimeType),
			data: image.dataBase64,
		},
	};
}

export function toGeminiInlineDataPart(image: ChatImageAttachment): GeminiInlineDataPart {
	return {
		inlineData: {
			mimeType: image.mimeType || 'image/png',
			data: image.dataBase64,
		},
	};
}

export function materializeUserMessageContent(
	text: string,
	images: ChatImageAttachment[] | undefined,
	format: LLMImageFormat,
): string | Array<OpenAITextPart | OpenAIImagePart> | Array<AnthropicTextPart | AnthropicImagePart> {
	if (!images?.length) {
		return text;
	}
	if (format === 'openai') {
		const parts: Array<OpenAITextPart | OpenAIImagePart> = [];
		if (text) {
			parts.push({ type: 'text', text });
		}
		for (const image of images) {
			parts.push(toOpenAIImagePart(image));
		}
		return parts;
	}
	const parts: Array<AnthropicTextPart | AnthropicImagePart> = [];
	if (text) {
		parts.push({ type: 'text', text });
	}
	for (const image of images) {
		parts.push(toAnthropicImagePart(image));
	}
	return parts;
}

export function mergeImageAttachments(
	left: ChatImageAttachment[] | undefined,
	right: ChatImageAttachment[] | undefined,
): ChatImageAttachment[] | undefined {
	if (!left?.length && !right?.length) {
		return undefined;
	}
	return [...(left ?? []), ...(right ?? [])];
}

export async function collectImagesFromSelections(
	selections: StagingSelectionItem[] | null | undefined,
	readBytes?: (uri: URI) => Promise<{ bytes: Uint8Array } | null>,
): Promise<ChatImageAttachment[]> {
	const images: ChatImageAttachment[] = [];
	for (const selection of selections ?? []) {
		if (selection.type === 'Image') {
			if (selection.dataBase64) {
				images.push({
					name: selection.name,
					mimeType: selection.mimeType || guessMimeType(selection.name, 'image/png'),
					dataBase64: selection.dataBase64,
				});
			}
			continue;
		}
		if (selection.type !== 'File') {
			continue;
		}
		if (!isImageFileName(selection.uri.fsPath) && !isImageFileName(selection.uri.path)) {
			continue;
		}
		if (!readBytes) {
			continue;
		}
		const read = await readBytes(selection.uri);
		if (!read?.bytes?.length) {
			continue;
		}
		if (read.bytes.byteLength > MAX_IMAGE_BYTES) {
			continue;
		}
		images.push({
			name: selection.uri.fsPath.split(/[/\\]/).pop() || 'image',
			mimeType: guessMimeType(selection.uri.fsPath, 'image/png'),
			dataBase64: encodeBytesToBase64(read.bytes),
		});
	}
	return images;
}

export function insertTranscriptIntoText(
	current: string,
	transcript: string,
	selectionStart = current.length,
	selectionEnd = current.length,
): { next: string; cursor: number } {
	const spoken = transcript.trim();
	if (!spoken) {
		return { next: current, cursor: selectionStart };
	}
	const before = current.slice(0, selectionStart);
	const after = current.slice(selectionEnd);
	const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
	const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
	const inserted = `${needsSpaceBefore ? ' ' : ''}${spoken}${needsSpaceAfter ? ' ' : ''}`;
	const next = before + inserted + after;
	return { next, cursor: (before + inserted).length };
}

export type SpeechRecognitionLike = {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
	onerror: ((event: { error?: string }) => void) | null;
	onend: (() => void) | null;
	start: () => void;
	stop: () => void;
	abort?: () => void;
};

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionConstructor(globals: unknown): SpeechRecognitionCtor | null {
	if (!globals || typeof globals !== 'object') {
		return null;
	}
	const g = globals as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
	return g.SpeechRecognition || g.webkitSpeechRecognition || null;
}

export function applyLiveTranscript(
	baseline: string,
	finalTranscript: string,
	interimTranscript: string,
): string {
	const spoken = [finalTranscript, interimTranscript].map(s => s.trim()).filter(Boolean).join(' ');
	if (!spoken) {
		return baseline;
	}
	return insertTranscriptIntoText(baseline, spoken, baseline.length, baseline.length).next;
}
