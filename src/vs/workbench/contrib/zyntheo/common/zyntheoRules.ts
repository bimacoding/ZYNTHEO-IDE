/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export const ZYNTHEO_DIR_NAME = '.zyntheo'
export const ZYNTHEO_RULES_DIR = 'rules'
export const ZYNTHEO_SKILLS_DIR = 'skills'
export const ZYNTHEO_RULES_FILE_NAMES = ['.zyntheorules', '.voidrules', '.cursorrules', 'AGENTS.md', 'RULE.md', 'rules.md']
export const ZYNTHEO_RULE_EXTENSIONS = ['.mdc', '.md', '.txt']
export const MAX_RULE_OR_SKILL_CHARS = 80_000
export const MAX_PROMPT_RULES = 24
export const MAX_PROMPT_SKILLS = 16

export type ZyntheoGuidanceSource = 'workspace' | 'user' | 'legacy'

export type ZyntheoRule = {
	id: string
	name: string
	path: string
	source: ZyntheoGuidanceSource
	description: string
	globs: string[]
	alwaysApply: boolean
	body: string
}

export type ZyntheoSkill = {
	id: string
	name: string
	path: string
	source: ZyntheoGuidanceSource
	description: string
	disableModelInvocation: boolean
	body: string
}

export type RulesSkillsContext = {
	openedPaths?: string[]
	activePath?: string
	userQuery?: string
}

export type ParsedFrontmatter = {
	raw: Record<string, string>
	description?: string
	name?: string
	globs: string[]
	alwaysApply?: boolean
	disableModelInvocation?: boolean
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export function stripBom(text: string): string {
	return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

export function fileNameFromPath(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/')
	const parts = normalized.split('/')
	return parts[parts.length - 1] || filePath
}

export function stemFromFileName(fileName: string): string {
	return fileName.replace(/\.(mdc|md|txt)$/i, '')
}

export function slugifySkillName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64)
}

export function isRuleFileName(fileName: string): boolean {
	const lower = fileName.toLowerCase()
	if (ZYNTHEO_RULES_FILE_NAMES.some(name => name.toLowerCase() === lower)) {
		return true
	}
	return ZYNTHEO_RULE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

export function isSkillFileName(fileName: string, parentDirName?: string): boolean {
	const lower = fileName.toLowerCase()
	if (lower === 'skill.md') {
		return true
	}
	if (parentDirName && parentDirName.toLowerCase() === ZYNTHEO_SKILLS_DIR && ZYNTHEO_RULE_EXTENSIONS.some(ext => lower.endsWith(ext))) {
		return true
	}
	return false
}

export function parseFrontmatter(content: string): { frontmatter: ParsedFrontmatter; body: string } {
	const text = stripBom(content).replace(/\r\n/g, '\n')
	const match = FRONTMATTER_RE.exec(text)
	if (!match) {
		return {
			frontmatter: { raw: {}, globs: [] },
			body: text.trim(),
		}
	}

	const raw = parseSimpleYaml(match[1])
	const body = text.slice(match[0].length).trim()
	return {
		frontmatter: {
			raw,
			description: asOptionalString(raw.description),
			name: asOptionalString(raw.name),
			globs: parseGlobs(raw.globs),
			alwaysApply: asOptionalBoolean(raw.alwaysApply ?? raw.always_apply ?? raw['always-apply']),
			disableModelInvocation: asOptionalBoolean(
				raw['disable-model-invocation'] ?? raw.disableModelInvocation ?? raw.disable_model_invocation
			),
		},
		body,
	}
}

export function parseRuleDocument(opts: { path: string; content: string; source: ZyntheoGuidanceSource }): ZyntheoRule {
	const fileName = fileNameFromPath(opts.path)
	const { frontmatter, body } = parseFrontmatter(opts.content)
	const globs = frontmatter.globs
	const alwaysApply = frontmatter.alwaysApply ?? (globs.length === 0 && !frontmatter.description)
	const name = frontmatter.name || stemFromFileName(fileName)
	return {
		id: `${opts.source}:${normalizePath(opts.path)}`,
		name,
		path: opts.path,
		source: opts.source,
		description: frontmatter.description || '',
		globs,
		alwaysApply,
		body: clipText(body || opts.content.trim()),
	}
}

export function parseSkillDocument(opts: { path: string; content: string; source: ZyntheoGuidanceSource }): ZyntheoSkill {
	const fileName = fileNameFromPath(opts.path)
	const { frontmatter, body } = parseFrontmatter(opts.content)
	const fallbackName = fileName.toLowerCase() === 'skill.md'
		? parentDirName(opts.path) || 'skill'
		: stemFromFileName(fileName)
	const name = slugifySkillName(frontmatter.name || fallbackName) || fallbackName
	return {
		id: `${opts.source}:${normalizePath(opts.path)}`,
		name,
		path: opts.path,
		source: opts.source,
		description: frontmatter.description || '',
		disableModelInvocation: frontmatter.disableModelInvocation ?? false,
		body: clipText(body || opts.content.trim()),
	}
}

export function pathMatchesGlob(filePath: string, pattern: string): boolean {
	const normalizedPath = normalizePath(filePath)
	const normalizedPattern = pattern.trim().replace(/\\/g, '/')
	if (!normalizedPath || !normalizedPattern) {
		return false
	}

	const matcher = globToRegExp(normalizedPattern)
	if (matcher.test(normalizedPath)) {
		return true
	}

	const segments = normalizedPath.split('/')
	for (let i = 0; i < segments.length; i++) {
		const suffix = segments.slice(i).join('/')
		if (matcher.test(suffix)) {
			return true
		}
	}

	return matcher.test(segments[segments.length - 1] || '')
}

export function ruleApplies(rule: ZyntheoRule, context: RulesSkillsContext = {}): boolean {
	if (rule.alwaysApply) {
		return true
	}

	const files = collectContextPaths(context)
	if (rule.globs.length && files.some(filePath => rule.globs.some(glob => pathMatchesGlob(filePath, glob)))) {
		return true
	}

	if (!rule.globs.length && rule.description) {
		return textLooksRelevant(context.userQuery, [rule.name, rule.description])
	}

	return false
}

export function skillShouldExpand(skill: ZyntheoSkill, context: RulesSkillsContext = {}): boolean {
	const query = context.userQuery || ''
	if (mentionsSkill(query, skill)) {
		return true
	}
	if (skill.disableModelInvocation) {
		return false
	}
	return textLooksRelevant(query, [skill.name, skill.description])
}

export function selectActiveRules(rules: ZyntheoRule[], context: RulesSkillsContext = {}): ZyntheoRule[] {
	const selected: ZyntheoRule[] = []
	const seen = new Set<string>()
	for (const rule of dedupeByName(rules)) {
		if (!ruleApplies(rule, context)) {
			continue
		}
		const key = rule.name.toLowerCase()
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		selected.push(rule)
		if (selected.length >= MAX_PROMPT_RULES) {
			break
		}
	}
	return selected
}

export function selectCatalogSkills(skills: ZyntheoSkill[]): ZyntheoSkill[] {
	return dedupeByName(skills).slice(0, MAX_PROMPT_SKILLS)
}

export function selectExpandedSkills(skills: ZyntheoSkill[], context: RulesSkillsContext = {}): ZyntheoSkill[] {
	const selected: ZyntheoSkill[] = []
	const seen = new Set<string>()
	for (const skill of dedupeByName(skills)) {
		if (!skillShouldExpand(skill, context)) {
			continue
		}
		const key = skill.name.toLowerCase()
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		selected.push(skill)
		if (selected.length >= MAX_PROMPT_SKILLS) {
			break
		}
	}
	return selected
}

export function formatRulesAndSkillsForPrompt(opts: {
	rules: ZyntheoRule[]
	skills: ZyntheoSkill[]
	context?: RulesSkillsContext
}): string {
	const context = opts.context || {}
	const activeRules = selectActiveRules(opts.rules, context)
	const catalogSkills = selectCatalogSkills(opts.skills)
	const expandedSkills = selectExpandedSkills(opts.skills, context)
	const inactiveRules = dedupeByName(opts.rules).filter(rule => !activeRules.some(active => active.id === rule.id) && rule.description)

	const parts: string[] = []

	if (activeRules.length) {
		parts.push(`<zyntheo_rules>
You MUST follow these project/user rules. They override generic defaults when they conflict.

${activeRules.map(formatRuleBlock).join('\n\n')}
</zyntheo_rules>`)
	}

	if (inactiveRules.length) {
		parts.push(`<zyntheo_rule_catalog>
Additional rules exist and should be followed when relevant:
${inactiveRules.map(rule => `- ${rule.name}: ${rule.description}`).join('\n')}
</zyntheo_rule_catalog>`)
	}

	if (catalogSkills.length) {
		parts.push(`<zyntheo_skills>
The following skills are available. When a skill is relevant, follow its instructions closely.
${catalogSkills.map(skill => `- ${skill.name}: ${skill.description || 'No description provided.'}${skill.disableModelInvocation ? ' (load only when explicitly requested)' : ''}`).join('\n')}
</zyntheo_skills>`)
	}

	if (expandedSkills.length) {
		parts.push(`<zyntheo_active_skills>
${expandedSkills.map(formatSkillBlock).join('\n\n')}
</zyntheo_active_skills>`)
	}

	return parts.join('\n\n').trim()
}

export function formatAlwaysApplyInstructions(rules: ZyntheoRule[]): string {
	return selectActiveRules(rules, {}).map(rule => rule.body).filter(Boolean).join('\n\n').trim()
}

function formatRuleBlock(rule: ZyntheoRule): string {
	const meta: string[] = [`name: ${rule.name}`, `source: ${rule.source}`]
	if (rule.description) {
		meta.push(`description: ${rule.description}`)
	}
	if (rule.globs.length) {
		meta.push(`globs: ${rule.globs.join(', ')}`)
	}
	return `<rule>
${meta.join('\n')}

${rule.body}
</rule>`
}

function formatSkillBlock(skill: ZyntheoSkill): string {
	return `<skill name="${skill.name}" path="${skill.path}">
${skill.body}
</skill>`
}

function parseSimpleYaml(block: string): Record<string, string> {
	const result: Record<string, string> = {}
	const lines = block.replace(/\r\n/g, '\n').split('\n')
	let currentKey: string | undefined
	const pendingList: string[] = []

	const flushList = () => {
		if (!currentKey) {
			return
		}
		if (pendingList.length) {
			result[currentKey] = pendingList.join(',')
			pendingList.length = 0
		}
	}

	for (const rawLine of lines) {
		const line = rawLine.trimEnd()
		if (!line.trim() || line.trim().startsWith('#')) {
			continue
		}

		const listMatch = line.match(/^[ \t]+-\s+(.*)$/)
		if (listMatch && currentKey) {
			pendingList.push(unquote(listMatch[1].trim()))
			continue
		}

		const kvMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
		if (!kvMatch) {
			continue
		}

		flushList()
		currentKey = kvMatch[1]
		const value = kvMatch[2].trim()
		if (!value || value === '|' || value === '>') {
			result[currentKey] = ''
			continue
		}
		result[currentKey] = unquote(value)
	}

	flushList()
	return result
}

function parseGlobs(value: string | undefined): string[] {
	if (!value) {
		return []
	}
	const trimmed = value.trim()
	const inner = trimmed.startsWith('[') && trimmed.endsWith(']')
		? trimmed.slice(1, -1)
		: trimmed
	return inner
		.split(/[,]+/)
		.map(part => unquote(part.trim()))
		.filter(Boolean)
}

function asOptionalString(value: string | undefined): string | undefined {
	const trimmed = value?.trim()
	return trimmed ? trimmed : undefined
}

function asOptionalBoolean(value: string | undefined): boolean | undefined {
	if (value === undefined) {
		return undefined
	}
	const normalized = value.trim().toLowerCase()
	if (['true', 'yes', '1'].includes(normalized)) {
		return true
	}
	if (['false', 'no', '0'].includes(normalized)) {
		return false
	}
	return undefined
}

function unquote(value: string): string {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
		return value.slice(1, -1)
	}
	return value
}

function normalizePath(filePath: string): string {
	return filePath.replace(/\\/g, '/')
}

function parentDirName(filePath: string): string {
	const normalized = normalizePath(filePath)
	const parts = normalized.split('/').filter(Boolean)
	return parts.length >= 2 ? parts[parts.length - 2] : ''
}

function clipText(value: string): string {
	if (value.length <= MAX_RULE_OR_SKILL_CHARS) {
		return value
	}
	return `${value.slice(0, MAX_RULE_OR_SKILL_CHARS)}\n\n[truncated]`
}

function collectContextPaths(context: RulesSkillsContext): string[] {
	const paths = [...(context.openedPaths || [])]
	if (context.activePath) {
		paths.unshift(context.activePath)
	}
	return [...new Set(paths.filter(Boolean))]
}

function mentionsSkill(query: string, skill: ZyntheoSkill): boolean {
	if (!query.trim()) {
		return false
	}
	const haystack = query.toLowerCase()
	const names = [skill.name, skill.name.replace(/-/g, ' ')].map(value => value.toLowerCase()).filter(Boolean)
	return names.some(name => name.length >= 3 && haystack.includes(name))
}

function textLooksRelevant(query: string | undefined, parts: string[]): boolean {
	if (!query || !query.trim()) {
		return false
	}
	const haystack = query.toLowerCase()
	const keywords = uniqueKeywords(parts.join(' '))
	if (!keywords.length) {
		return false
	}
	const hits = keywords.filter(keyword => haystack.includes(keyword)).length
	return hits >= Math.min(2, keywords.length)
}

function uniqueKeywords(text: string): string[] {
	const stop = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'when', 'use', 'using', 'into', 'your', 'you', 'are', 'was', 'will', 'can', 'should', 'must', 'have', 'has', 'not', 'but', 'all', 'any'])
	return [...new Set(
		text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, ' ')
			.split(/[\s-]+/)
			.map(word => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word)
			.filter(word => word.length >= 4 && !stop.has(word))
	)]
}

function dedupeByName<T extends { name: string; source: ZyntheoGuidanceSource }>(items: T[]): T[] {
	const rank: Record<ZyntheoGuidanceSource, number> = { workspace: 0, user: 1, legacy: 2 }
	const sorted = [...items].sort((a, b) => rank[a.source] - rank[b.source])
	const seen = new Set<string>()
	const result: T[] = []
	for (const item of sorted) {
		const key = item.name.toLowerCase()
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		result.push(item)
	}
	return result
}

function globToRegExp(pattern: string): RegExp {
	let i = 0
	let out = '^'
	while (i < pattern.length) {
		const char = pattern[i]
		if (char === '*') {
			if (pattern[i + 1] === '*') {
				if (pattern[i + 2] === '/') {
					out += '(?:.*/)?'
					i += 3
					continue
				}
				out += '.*'
				i += 2
				continue
			}
			out += '[^/]*'
			i += 1
			continue
		}
		if (char === '?') {
			out += '[^/]'
			i += 1
			continue
		}
		if (char === '{') {
			const end = pattern.indexOf('}', i)
			if (end !== -1) {
				const options = pattern.slice(i + 1, end).split(',').map(globToRegExpSource)
				out += `(?:${options.join('|')})`
				i = end + 1
				continue
			}
		}
		out += escapeRegex(char)
		i += 1
	}
	out += '$'
	return new RegExp(out, 'i')
}

function globToRegExpSource(pattern: string): string {
	return globToRegExp(pattern).source.replace(/^\^/, '').replace(/\$$/, '')
}

function escapeRegex(value: string): string {
	return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
}
