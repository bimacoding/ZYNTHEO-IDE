/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { env } from '../../../../base/common/process.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { os } from '../common/helpers/systemInfo.js';

export const USER_DATA_MIGRATION_FLAG = 'zyntheo.userDataMigration.voidToZyntheo.v1';

export interface IUserDataMigrationService {
	readonly _serviceBrand: undefined;
	migrateFromVoidIfNeeded(): Promise<MigrationReport>;
}

export const IUserDataMigrationService = createDecorator<IUserDataMigrationService>('UserDataMigrationService');

export interface MigrationReport {
	ran: boolean;
	skippedReason?: string;
	copied: string[];
	errors: string[];
	backupDir?: string;
}

type PathPair = { label: string; from: URI; to: URI; isDir?: boolean };

function voidToZyntheoPaths(platform: 'mac' | 'windows' | 'linux' | null): PathPair[] {
	if (platform === 'mac') {
		const home = env['HOME'];
		if (!home) {
			return [];
		}
		return [
			{
				label: 'settings.json',
				from: URI.joinPath(URI.file(home), 'Library', 'Application Support', 'Void', 'User', 'settings.json'),
				to: URI.joinPath(URI.file(home), 'Library', 'Application Support', 'Zyntheo', 'User', 'settings.json'),
			},
			{
				label: 'keybindings.json',
				from: URI.joinPath(URI.file(home), 'Library', 'Application Support', 'Void', 'User', 'keybindings.json'),
				to: URI.joinPath(URI.file(home), 'Library', 'Application Support', 'Zyntheo', 'User', 'keybindings.json'),
			},
			{
				label: 'extensions',
				from: URI.joinPath(URI.file(home), '.void-editor', 'extensions'),
				to: URI.joinPath(URI.file(home), '.zyntheo-editor', 'extensions'),
				isDir: true,
			},
		];
	}
	if (platform === 'linux') {
		const home = env['HOME'];
		if (!home) {
			return [];
		}
		return [
			{
				label: 'settings.json',
				from: URI.joinPath(URI.file(home), '.config', 'Void', 'User', 'settings.json'),
				to: URI.joinPath(URI.file(home), '.config', 'Zyntheo', 'User', 'settings.json'),
			},
			{
				label: 'keybindings.json',
				from: URI.joinPath(URI.file(home), '.config', 'Void', 'User', 'keybindings.json'),
				to: URI.joinPath(URI.file(home), '.config', 'Zyntheo', 'User', 'keybindings.json'),
			},
			{
				label: 'extensions',
				from: URI.joinPath(URI.file(home), '.void-editor', 'extensions'),
				to: URI.joinPath(URI.file(home), '.zyntheo-editor', 'extensions'),
				isDir: true,
			},
		];
	}
	if (platform === 'windows') {
		const appdata = env['APPDATA'];
		const userprofile = env['USERPROFILE'];
		if (!appdata || !userprofile) {
			return [];
		}
		return [
			{
				label: 'settings.json',
				from: URI.joinPath(URI.file(appdata), 'Void', 'User', 'settings.json'),
				to: URI.joinPath(URI.file(appdata), 'Zyntheo', 'User', 'settings.json'),
			},
			{
				label: 'keybindings.json',
				from: URI.joinPath(URI.file(appdata), 'Void', 'User', 'keybindings.json'),
				to: URI.joinPath(URI.file(appdata), 'Zyntheo', 'User', 'keybindings.json'),
			},
			{
				label: 'extensions',
				from: URI.joinPath(URI.file(userprofile), '.void-editor', 'extensions'),
				to: URI.joinPath(URI.file(userprofile), '.zyntheo-editor', 'extensions'),
				isDir: true,
			},
		];
	}
	return [];
}

class UserDataMigrationService extends Disposable implements IUserDataMigrationService {
	_serviceBrand: undefined;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async migrateFromVoidIfNeeded(): Promise<MigrationReport> {
		const report: MigrationReport = { ran: false, copied: [], errors: [] };

		if (this.storageService.get(USER_DATA_MIGRATION_FLAG, StorageScope.APPLICATION)) {
			report.skippedReason = 'already-migrated';
			return report;
		}

		const pairs = voidToZyntheoPaths(os);
		if (!pairs.length) {
			report.skippedReason = 'unsupported-platform';
			this.storageService.store(USER_DATA_MIGRATION_FLAG, 'skipped-unsupported', StorageScope.APPLICATION, StorageTarget.MACHINE);
			return report;
		}

		let anySource = false;
		for (const p of pairs) {
			if (await this.fileService.exists(p.from)) {
				anySource = true;
				break;
			}
		}
		if (!anySource) {
			report.skippedReason = 'no-void-data';
			this.storageService.store(USER_DATA_MIGRATION_FLAG, 'skipped-no-source', StorageScope.APPLICATION, StorageTarget.MACHINE);
			return report;
		}

		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupRoot = pairs[0].to.with({ path: pairs[0].to.path.replace(/\/User\/.*$/, `/User/.zyntheo-migration-backup-${stamp}`) });
		report.backupDir = backupRoot.fsPath;
		report.ran = true;

		try {
			await this.fileService.createFolder(backupRoot);
		} catch (e) {
			this.logService.warn('[Zyntheo migration] backup folder create failed (continuing)', e);
		}

		for (const pair of pairs) {
			try {
				const sourceExists = await this.fileService.exists(pair.from);
				if (!sourceExists) {
					continue;
				}
				const destExists = await this.fileService.exists(pair.to);
				if (destExists) {
					// Backup existing destination before overwrite of missing-only policy: skip if dest exists
					try {
						const backupTarget = URI.joinPath(backupRoot, pair.label.replace(/\//g, '_'));
						await this.fileService.copy(pair.to, backupTarget, true);
					} catch (e) {
						this.logService.warn(`[Zyntheo migration] backup of existing ${pair.label} failed`, e);
					}
					report.copied.push(`${pair.label}:skipped-dest-exists`);
					continue;
				}
				const parent = URI.joinPath(pair.to, '..');
				if (!(await this.fileService.exists(parent))) {
					await this.fileService.createFolder(parent);
				}
				await this.fileService.copy(pair.from, pair.to, true);
				report.copied.push(pair.label);
				this.logService.info(`[Zyntheo migration] copied ${pair.label} (no secrets logged)`);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				report.errors.push(`${pair.label}:${msg}`);
				this.logService.error(`[Zyntheo migration] failed ${pair.label}`, msg);
			}
		}

		// Verification: destinations that we claimed to copy must exist
		for (const label of report.copied.filter(c => !c.includes('skipped'))) {
			const pair = pairs.find(p => p.label === label);
			if (pair && !(await this.fileService.exists(pair.to))) {
				report.errors.push(`verify-failed:${label}`);
			}
		}

		const status = report.errors.length ? `done-with-errors:${report.errors.length}` : 'done';
		this.storageService.store(USER_DATA_MIGRATION_FLAG, status, StorageScope.APPLICATION, StorageTarget.MACHINE);

		// Persist a non-secret report for support/debug
		try {
			const reportUri = URI.joinPath(backupRoot, 'migration-report.json');
			const safeReport = {
				...report,
				note: 'Void source data was not deleted. Rollback: copy from backupDir back to Zyntheo paths, or re-use Void folders.',
			};
			await this.fileService.writeFile(reportUri, VSBuffer.fromString(JSON.stringify(safeReport, null, 2)));
		} catch {
			// ignore report write failures
		}

		return report;
	}
}

registerSingleton(IUserDataMigrationService, UserDataMigrationService, InstantiationType.Delayed);

class UserDataMigrationContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.zyntheoUserDataMigration';

	constructor(
		@IUserDataMigrationService migrationService: IUserDataMigrationService,
		@ILogService logService: ILogService,
	) {
		super();
		migrationService.migrateFromVoidIfNeeded().then(report => {
			if (report.ran) {
				logService.info('[Zyntheo migration] completed', JSON.stringify({ copied: report.copied, errors: report.errors.length }));
			}
		}).catch(err => {
			logService.error('[Zyntheo migration] unexpected failure', err);
		});
	}
}

registerWorkbenchContribution2(UserDataMigrationContribution.ID, UserDataMigrationContribution, WorkbenchPhase.Eventually);
