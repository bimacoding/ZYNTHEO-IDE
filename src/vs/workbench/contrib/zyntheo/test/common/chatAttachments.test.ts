/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	applyLiveTranscript,
	collectImagesFromSelections,
	createImageStagingSelection,
	describeBinaryFileForPrompt,
	describeImageForPrompt,
	encodeBytesToBase64,
	getFileExtension,
	getSpeechRecognitionConstructor,
	guessMimeType,
	insertTranscriptIntoText,
	isImageFileName,
	isImageMimeType,
	isProbablyBinaryString,
	materializeUserMessageContent,
	toAnthropicImagePart,
	toAnthropicMediaType,
	toGeminiInlineDataPart,
	toOpenAIImagePart,
} from '../../common/chatAttachments.js';
import { StagingSelectionItem } from '../../common/chatThreadServiceTypes.js';

suite('Zyntheo chat attachments', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('detects image filenames and mime types', () => {
		assert.strictEqual(isImageFileName('photo.PNG'), true);
		assert.strictEqual(isImageFileName('/tmp/diagram.webp'), true);
		assert.strictEqual(isImageFileName('notes.md'), false);
		assert.strictEqual(isImageMimeType('image/png'), true);
		assert.strictEqual(isImageMimeType('text/plain'), false);
		assert.strictEqual(getFileExtension('a/b/c.JPEG'), 'jpeg');
		assert.strictEqual(guessMimeType('shot.jpg'), 'image/jpeg');
		assert.strictEqual(guessMimeType('data.json'), 'application/json');
	});

	test('detects binary strings and encodes base64', () => {
		assert.strictEqual(isProbablyBinaryString('hello world'), false);
		assert.strictEqual(isProbablyBinaryString('abc\u0000def'), true);
		assert.strictEqual(encodeBytesToBase64(new Uint8Array([72, 105])), 'SGk=');
	});

	test('creates image staging selections', () => {
		const selection = createImageStagingSelection({
			name: 'ui.png',
			mimeType: 'image/png',
			dataBase64: 'abc123',
		});
		assert.strictEqual(selection.type, 'Image');
		assert.strictEqual(selection.name, 'ui.png');
		assert.strictEqual(selection.mimeType, 'image/png');
		assert.strictEqual(selection.dataBase64, 'abc123');
		assert.ok(selection.uri.path.includes('ui.png'));
	});

	test('materializes OpenAI and Anthropic image parts', () => {
		const image = { name: 'ui.png', mimeType: 'image/png', dataBase64: 'abc123' };
		const openai = materializeUserMessageContent('look at this', [image], 'openai');
		assert.ok(Array.isArray(openai));
		assert.deepStrictEqual(openai[0], { type: 'text', text: 'look at this' });
		assert.deepStrictEqual(openai[1], toOpenAIImagePart(image));
		assert.strictEqual((openai[1] as ReturnType<typeof toOpenAIImagePart>).image_url.url, 'data:image/png;base64,abc123');

		const anthropic = materializeUserMessageContent('look at this', [image], 'anthropic');
		assert.ok(Array.isArray(anthropic));
		assert.deepStrictEqual(anthropic[1], toAnthropicImagePart(image));
		assert.strictEqual(toAnthropicMediaType('image/jpg'), 'image/jpeg');
		assert.strictEqual(toAnthropicMediaType('image/svg+xml'), 'image/png');
		assert.deepStrictEqual(toGeminiInlineDataPart(image), { inlineData: { mimeType: 'image/png', data: 'abc123' } });
	});

	test('inserts voice transcript like Cursor dictation', () => {
		const inserted = insertTranscriptIntoText('Fix the', 'login form', 7, 7);
		assert.strictEqual(inserted.next, 'Fix the login form');
		assert.strictEqual(inserted.cursor, 'Fix the login form'.length);

		const live = applyLiveTranscript('Fix the', 'login', 'form');
		assert.strictEqual(live, 'Fix the login form');
	});

	test('finds SpeechRecognition constructor when available', () => {
		assert.strictEqual(getSpeechRecognitionConstructor({}), null);
		class FakeRecognition { }
		const found = getSpeechRecognitionConstructor({ webkitSpeechRecognition: FakeRecognition });
		assert.strictEqual(found, FakeRecognition);
	});

	test('collects image attachments from mixed selections', async () => {
		const imageSel = createImageStagingSelection({
			name: 'paste.png',
			mimeType: 'image/png',
			dataBase64: 'paste',
			uri: URI.from({ scheme: 'zyntheo-image', path: '/paste.png' }),
		});
		const fileImage: StagingSelectionItem = {
			type: 'File',
			uri: URI.file('/tmp/shot.jpg'),
			language: 'plaintext',
			state: { wasAddedAsCurrentFile: false },
		};
		const textFile: StagingSelectionItem = {
			type: 'File',
			uri: URI.file('/tmp/readme.md'),
			language: 'markdown',
			state: { wasAddedAsCurrentFile: false },
		};
		const images = await collectImagesFromSelections([imageSel, fileImage, textFile], async (uri) => {
			if (uri.fsPath.endsWith('shot.jpg')) {
				return { bytes: new Uint8Array([1, 2, 3]) };
			}
			return null;
		});
		assert.strictEqual(images.length, 2);
		assert.strictEqual(images[0].name, 'paste.png');
		assert.strictEqual(images[1].name, 'shot.jpg');
		assert.ok(images[1].dataBase64.length > 0);
	});

	test('describes image and binary files for text fallback', () => {
		assert.ok(describeImageForPrompt('ui.png', 'image/png').includes('ui.png'));
		assert.ok(describeBinaryFileForPrompt('/tmp/a.bin', 12).includes('binary file'));
	});
});
