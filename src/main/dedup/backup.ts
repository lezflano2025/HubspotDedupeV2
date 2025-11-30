import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { ContactRepository, CompanyRepository, DuplicateGroupRepository } from '../db';

/**
 * Backup functionality for merge operations
 * Creates JSON backups before merging to allow recovery if needed
 */

export interface MergeBackup {
  timestamp: string;
  groupId: string;
  objectType: 'contact' | 'company';
  primaryRecordId: string;
  records: unknown[];
  metadata: {
    confidence: string;
    matchScore: number;
    matchedFields: string[];
  };
}

/**
 * Get the backup directory path
 */
function getBackupDirectory(): string {
  const userDataPath = app.getPath('userData');
  const backupDir = path.join(userDataPath, 'backups');

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  return backupDir;
}

/**
 * Create a backup of records before merging
 */
export function createMergeBackup(groupId: string, primaryRecordId: string): string {
  console.log(`Creating backup for group ${groupId}...`);

  // Get the duplicate group
  const group = DuplicateGroupRepository.findById(groupId);
  if (!group) {
    throw new Error(`Duplicate group ${groupId} not found`);
  }

  // Get all potential matches in the group
  const matches = DuplicateGroupRepository.getMatches(groupId);
  if (matches.length === 0) {
    throw new Error(`No matches found for group ${groupId}`);
  }

  // Fetch full records based on object type
  const records =
    group.object_type === 'contact'
      ? matches.map((m) => ContactRepository.findByHsId(m.record_hs_id)).filter((r) => r !== null)
      : matches.map((m) => CompanyRepository.findByHsId(m.record_hs_id)).filter((r) => r !== null);

  // Create backup object
  const backup: MergeBackup = {
    timestamp: new Date().toISOString(),
    groupId,
    objectType: group.object_type as 'contact' | 'company',
    primaryRecordId,
    records,
    metadata: {
      confidence: group.confidence_level,
      matchScore: matches[0]?.match_score || 0,
      matchedFields: matches[0]?.matched_fields ? JSON.parse(matches[0].matched_fields) : [],
    },
  };

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `merge_backup_${group.object_type}_${groupId}_${timestamp}.json`;
  const backupPath = path.join(getBackupDirectory(), filename);

  // Write backup to file
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');

  console.log(`Backup created: ${backupPath}`);
  return backupPath;
}

/**
 * List all backup files
 */
export function listBackups(): string[] {
  const backupDir = getBackupDirectory();

  try {
    const files = fs.readdirSync(backupDir);
    return files.filter((f) => f.startsWith('merge_backup_') && f.endsWith('.json')).map((f) => path.join(backupDir, f));
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

/**
 * Read a backup file
 */
export function readBackup(filePath: string): MergeBackup | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as MergeBackup;
  } catch (error) {
    console.error(`Error reading backup ${filePath}:`, error);
    return null;
  }
}

/**
 * Delete old backups (older than specified days)
 */
export function cleanupOldBackups(daysToKeep: number = 30): number {
  console.log(`Cleaning up backups older than ${daysToKeep} days...`);

  const backups = listBackups();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  let deleted = 0;

  for (const backupPath of backups) {
    const stats = fs.statSync(backupPath);
    if (stats.mtime < cutoffDate) {
      try {
        fs.unlinkSync(backupPath);
        deleted++;
        console.log(`Deleted old backup: ${path.basename(backupPath)}`);
      } catch (error) {
        console.error(`Failed to delete backup ${backupPath}:`, error);
      }
    }
  }

  console.log(`Cleanup complete. Deleted ${deleted} old backups.`);
  return deleted;
}

/**
 * Get backup directory path for user access
 */
export function getBackupDirectoryPath(): string {
  return getBackupDirectory();
}
