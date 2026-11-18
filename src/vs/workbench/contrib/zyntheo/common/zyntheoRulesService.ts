/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js'
import { Emitter, Event } from '../../../../base/common/event.js'
import { URI } from '../../../../base/common/uri.js'
import { VSBuffer } from '../../../../base/common/buffer.js'
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js'
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js'
import { dirname } from '../../../../base/common/resources.js'
import { IFileService } from '../../../../platform/files/common/files.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'
import { IEditorService } from '../../../services/editor/common/editorService.js'
import { IPathService } from '../../../services/path/common/pathService.js'
import {
	ZYNTHEO_DIR_NAME,
	ZYNTHEO_RULES_DIR,
	ZYNTHEO_SKILLS_DIR,
	ZYNTHEO_RULES_FILE_NAMES,
	RulesSkillsContext,
	ZyntheoGuidanceSource,
	ZyntheoRule,
	ZyntheoSkill,
	fileNameFromPath,
	formatAlwaysApplyInstructions,
	formatRulesAndSkillsForPrompt,
	isRuleFileName,
	isSkillFileName,
	parseRuleDocument,
	parseSkillDocument,
} from './zyntheoRules.js'

export type ZyntheoRulesSkillsSnapshot = {
	rules: ZyntheoRule[]
	skills: ZyntheoSkill[]
	workspaceRoots: string[]
	userRoot?: string
}

export interface IZyntheoRulesSkillsService {
	readonly _serviceBrand: undefined
	readonly onDidChange: Event<void>
	getCachedSnapshot(): ZyntheoRulesSkillsSnapshot
	getSnapshot(): Promise<ZyntheoRulesSkillsSnapshot>
	getPromptInstructions(context?: RulesSkillsContext): Promise<string>
	getAlwaysApplyInstructions(): Promise<string>
	revealWorkspaceRulesFolder(): Promise<URI | undefined>
	revealWorkspaceSkillsFolder(): Promise<URI | undefined>
}

export const IZyntheoRulesSkillsService = createDecorator<IZyntheoRulesSkillsService>('zyntheoRulesSkillsService')

const README_RULES = `---
description: Project-wide coding standards for Zyntheo agent
alwaysApply: true
---

# Project Rules

Write concise, actionable instructions for the Zyntheo agent.
Rules in this folder are loaded automatically.

Examples:
- Keep functions small and named clearly.
- Prefer existing project patterns over new abstractions.
`

const README_SKILL = `---
name: example-workflow
description: Example skill. Replace this with a real workflow the agent should follow. Use when the user mentions this workflow by name.
---

# Example Workflow

1. Restate the goal in one sentence.
2. Inspect only the files needed.
3. Apply the smallest correct change.
4. Verify with the project's usual checks.
`

class ZyntheoRulesSkillsService extends Disposable implements IZyntheoRulesSkillsService {
	declare readonly _serviceBrand: undefined

	private readonly _onDidChange = this._register(new Emitter<void>())
	readonly onDidChange = this._onDidChange.event

	private snapshot: ZyntheoRulesSkillsSnapshot = { rules: [], skills: [], workspaceRoots: [] }
	private loadPromise: Promise<ZyntheoRulesSkillsSnapshot> | undefined
	private readonly watched = new DisposableStore()
	private userRoot: URI | undefined

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IPathService private readonly pathService: IPathService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super()
		this._register(this.watched)
		this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => {
			void this.refresh('workspace-folders')
		}))
		this._register(this.fileService.onDidFilesChange(e => {
			const roots = this.currentWatchRoots()
			if (roots.some(root => e.affects(root))) {
				void this.refresh('files')
			}
		}))
		void this.refresh('init')
	}

	getCachedSnapshot(): ZyntheoRulesSkillsSnapshot {
		return this.snapshot
	}

	async getSnapshot(): Promise<ZyntheoRulesSkillsSnapshot> {
		if (this.loadPromise) {
			return this.loadPromise
		}
		return this.snapshot
	}

	async getPromptInstructions(context: RulesSkillsContext = {}): Promise<string> {
		const snapshot = await this.getSnapshot()
		return formatRulesAndSkillsForPrompt({
			rules: snapshot.rules,
			skills: snapshot.skills,
			context,
		})
	}

	async getAlwaysApplyInstructions(): Promise<string> {
		const snapshot = await this.getSnapshot()
		return formatAlwaysApplyInstructions(snapshot.rules)
	}

	async revealWorkspaceRulesFolder(): Promise<URI | undefined> {
		const folder = this.primaryWorkspaceFolder()
		if (!folder) {
			return undefined
		}
		const uri = URI.joinPath(folder, ZYNTHEO_DIR_NAME, ZYNTHEO_RULES_DIR)
		await this.ensureFolder(uri)
		const starter = URI.joinPath(uri, 'project.mdc')
		if (!(await this.fileService.exists(starter))) {
			await this.fileService.createFile(starter, VSBuffer.fromString(README_RULES))
		}
		await this.editorService.openEditor({ resource: starter, options: { pinned: true, revealIfOpened: true } })
		void this.refresh('reveal-rules')
		return uri
	}

	async revealWorkspaceSkillsFolder(): Promise<URI | undefined> {
		const folder = this.primaryWorkspaceFolder()
		if (!folder) {
			return undefined
		}
		const uri = URI.joinPath(folder, ZYNTHEO_DIR_NAME, ZYNTHEO_SKILLS_DIR, 'example-workflow')
		await this.ensureFolder(uri)
		const starter = URI.joinPath(uri, 'SKILL.md')
		if (!(await this.fileService.exists(starter))) {
			await this.fileService.createFile(starter, VSBuffer.fromString(README_SKILL))
		}
		await this.editorService.openEditor({ resource: starter, options: { pinned: true, revealIfOpened: true } })
		void this.refresh('reveal-skills')
		return uri
	}

	private refresh(_reason: string): Promise<ZyntheoRulesSkillsSnapshot> {
		this.loadPromise = this.loadAll().finally(() => {
			this.loadPromise = undefined
		})
		return this.loadPromise
	}

	private async loadAll(): Promise<ZyntheoRulesSkillsSnapshot> {
		const rules: ZyntheoRule[] = []
		const skills: ZyntheoSkill[] = []
		const workspaceRoots: string[] = []

		try {
			this.userRoot = await this.pathService.userHome()
		} catch {
			this.userRoot = undefined
		}

		const watchRoots: URI[] = []
		if (this.userRoot) {
			const userZyntheo = URI.joinPath(this.userRoot, ZYNTHEO_DIR_NAME)
			watchRoots.push(userZyntheo)
			await this.collectFromRoot(userZyntheo, 'user', rules, skills)
		}

		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			workspaceRoots.push(folder.uri.fsPath)
			const zyntheoRoot = URI.joinPath(folder.uri, ZYNTHEO_DIR_NAME)
			const cursorRoot = URI.joinPath(folder.uri, '.cursor')
			watchRoots.push(zyntheoRoot)
			watchRoots.push(cursorRoot)
			for (const fileName of ZYNTHEO_RULES_FILE_NAMES) {
				watchRoots.push(URI.joinPath(folder.uri, fileName))
			}
			await this.collectFromRoot(zyntheoRoot, 'workspace', rules, skills)
			await this.collectLegacyRootFiles(folder.uri, 'legacy', rules)
			await this.collectLegacyCursor(folder.uri, 'legacy', rules, skills)
		}

		this.replaceWatchedRoots(watchRoots)
		this.snapshot = {
			rules,
			skills,
			workspaceRoots,
			userRoot: this.userRoot?.fsPath,
		}
		this._onDidChange.fire()
		return this.snapshot
	}

	private async collectFromRoot(root: URI, source: ZyntheoGuidanceSource, rules: ZyntheoRule[], skills: ZyntheoSkill[]): Promise<void> {
		await this.collectRulesDir(URI.joinPath(root, ZYNTHEO_RULES_DIR), source, rules)
		await this.collectSkillsDir(URI.joinPath(root, ZYNTHEO_SKILLS_DIR), source, skills)
	}

	private async collectLegacyCursor(folder: URI, source: ZyntheoGuidanceSource, rules: ZyntheoRule[], skills: ZyntheoSkill[]): Promise<void> {
		await this.collectRulesDir(URI.joinPath(folder, '.cursor', ZYNTHEO_RULES_DIR), source, rules)
		await this.collectSkillsDir(URI.joinPath(folder, '.cursor', ZYNTHEO_SKILLS_DIR), source, skills)
	}

	private async collectLegacyRootFiles(folder: URI, source: ZyntheoGuidanceSource, rules: ZyntheoRule[]): Promise<void> {
		for (const fileName of ZYNTHEO_RULES_FILE_NAMES) {
			const uri = URI.joinPath(folder, fileName)
			const rule = await this.readRuleFile(uri, source)
			if (rule) {
				rules.push(rule)
			}
		}
	}

	private async collectRulesDir(dir: URI, source: ZyntheoGuidanceSource, rules: ZyntheoRule[]): Promise<void> {
		const files = await this.listFiles(dir, 3)
		for (const file of files) {
			if (!isRuleFileName(fileNameFromPath(file.fsPath))) {
				continue
			}
			const rule = await this.readRuleFile(file, source)
			if (rule) {
				rules.push(rule)
			}
		}
	}

	private async collectSkillsDir(dir: URI, source: ZyntheoGuidanceSource, skills: ZyntheoSkill[]): Promise<void> {
		const files = await this.listFiles(dir, 3)
		for (const file of files) {
			const parent = fileNameFromPath(dirname(file).fsPath)
			if (!isSkillFileName(fileNameFromPath(file.fsPath), parent)) {
				continue
			}
			const skill = await this.readSkillFile(file, source)
			if (skill) {
				skills.push(skill)
			}
		}
	}

	private async readRuleFile(uri: URI, source: ZyntheoGuidanceSource): Promise<ZyntheoRule | undefined> {
		const content = await this.readText(uri)
		if (content === undefined) {
			return undefined
		}
		return parseRuleDocument({ path: uri.fsPath, content, source })
	}

	private async readSkillFile(uri: URI, source: ZyntheoGuidanceSource): Promise<ZyntheoSkill | undefined> {
		const content = await this.readText(uri)
		if (content === undefined) {
			return undefined
		}
		return parseSkillDocument({ path: uri.fsPath, content, source })
	}

	private async readText(uri: URI): Promise<string | undefined> {
		try {
			if (!(await this.fileService.exists(uri))) {
				return undefined
			}
			const file = await this.fileService.readFile(uri)
			return file.value.toString()
		} catch {
			return undefined
		}
	}

	private async listFiles(dir: URI, maxDepth: number): Promise<URI[]> {
		try {
			if (!(await this.fileService.exists(dir))) {
				return []
			}
			const stat = await this.fileService.resolve(dir)
			if (!stat.isDirectory) {
				return []
			}
			const result: URI[] = []
			await this.walk(stat.children?.map(child => child.resource) || [], result, maxDepth)
			return result
		} catch {
			return []
		}
	}

	private async walk(uris: URI[], result: URI[], remainingDepth: number): Promise<void> {
		if (remainingDepth < 0) {
			return
		}
		for (const uri of uris) {
			try {
				const stat = await this.fileService.resolve(uri)
				if (stat.isDirectory) {
					if (remainingDepth > 0) {
						await this.walk(stat.children?.map(child => child.resource) || [], result, remainingDepth - 1)
					}
					continue
				}
				result.push(uri)
			} catch {
				continue
			}
		}
	}

	private async ensureFolder(uri: URI): Promise<void> {
		if (!(await this.fileService.exists(uri))) {
			await this.fileService.createFolder(uri)
		}
	}

	private primaryWorkspaceFolder(): URI | undefined {
		return this.workspaceContextService.getWorkspace().folders[0]?.uri
	}

	private replaceWatchedRoots(roots: URI[]): void {
		this.watched.clear()
		const seen = new Set<string>()
		for (const root of roots) {
			const key = root.toString()
			if (seen.has(key)) {
				continue
			}
			seen.add(key)
			try {
				this.watched.add(this.fileService.watch(root, { recursive: true, excludes: [] }))
			} catch {
				// Watching is best-effort; missing folders should not break chat.
			}
		}
	}

	private currentWatchRoots(): URI[] {
		const roots: URI[] = []
		if (this.userRoot) {
			roots.push(URI.joinPath(this.userRoot, ZYNTHEO_DIR_NAME))
		}
		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			roots.push(URI.joinPath(folder.uri, ZYNTHEO_DIR_NAME))
			roots.push(URI.joinPath(folder.uri, '.cursor'))
			for (const fileName of ZYNTHEO_RULES_FILE_NAMES) {
				roots.push(URI.joinPath(folder.uri, fileName))
			}
		}
		return roots
	}
}

registerSingleton(IZyntheoRulesSkillsService, ZyntheoRulesSkillsService, InstantiationType.Delayed)
