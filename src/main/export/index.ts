import { app, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DuplicateGroupRepository, ContactRepository, CompanyRepository } from '../db';
import type { ExportOptions, ExportResult, ExportableGroup, ExportableRecord } from '../../shared/types';

/**
 * Convert duplicate groups to exportable format
 */
function getExportableGroups(
  objectType: 'contact' | 'company',
  status?: string
): ExportableGroup[] {
  const groups = status === 'all'
    ? DuplicateGroupRepository.findByObjectType(objectType)
    : DuplicateGroupRepository.findByObjectType(objectType, status || 'pending');

  return groups.map(group => {
    const matches = DuplicateGroupRepository.getMatches(group.group_id);
    const Repository = objectType === 'contact' ? ContactRepository : CompanyRepository;

    const records: ExportableRecord[] = matches.map(match => {
      const record = Repository.findByHsId(match.record_hs_id);

      if (objectType === 'contact') {
        return {
          hsId: match.record_hs_id,
          isPrimary: match.is_primary === 1,
          firstName: record?.first_name || '',
          lastName: record?.last_name || '',
          email: record?.email || '',
          phone: record?.phone || '',
          company: record?.company || '',
          jobTitle: record?.job_title || '',
          createdAt: record?.created_at || '',
          updatedAt: record?.updated_at || '',
        };
      } else {
        return {
          hsId: match.record_hs_id,
          isPrimary: match.is_primary === 1,
          name: record?.name || '',
          domain: record?.domain || '',
          phone: record?.phone || '',
          industry: record?.industry || '',
          city: record?.city || '',
          state: record?.state || '',
          createdAt: record?.created_at || '',
          updatedAt: record?.updated_at || '',
        };
      }
    });

    // Parse matched fields from first match (they're the same for all in group)
    let matchedFields: string[] = [];
    if (matches[0]?.matched_fields) {
      try {
        matchedFields = JSON.parse(matches[0].matched_fields);
      } catch {
        matchedFields = [];
      }
    }

    return {
      groupId: group.group_id,
      objectType: group.object_type,
      confidenceLevel: group.confidence_level,
      similarityScore: matches[0]?.match_score || 0,
      status: group.status,
      recordCount: records.length,
      matchedFields,
      records,
    };
  });
}

/**
 * Convert groups to CSV format
 */
function groupsToCSV(groups: ExportableGroup[], objectType: 'contact' | 'company'): string {
  const rows: string[] = [];

  // Header row
  if (objectType === 'contact') {
    rows.push([
      'Group ID',
      'Confidence',
      'Similarity %',
      'Status',
      'Record Count',
      'Matched Fields',
      'Record #',
      'Is Primary',
      'HubSpot ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Company',
      'Job Title',
      'Created At',
      'Updated At',
    ].join(','));
  } else {
    rows.push([
      'Group ID',
      'Confidence',
      'Similarity %',
      'Status',
      'Record Count',
      'Matched Fields',
      'Record #',
      'Is Primary',
      'HubSpot ID',
      'Company Name',
      'Domain',
      'Phone',
      'Industry',
      'City',
      'State',
      'Created At',
      'Updated At',
    ].join(','));
  }

  // Data rows
  for (const group of groups) {
    group.records.forEach((record, index) => {
      const baseFields = [
        escapeCSV(group.groupId),
        group.confidenceLevel,
        (group.similarityScore * 100).toFixed(1),
        group.status,
        group.recordCount.toString(),
        escapeCSV(group.matchedFields.join('; ')),
        (index + 1).toString(),
        record.isPrimary ? 'Yes' : 'No',
        record.hsId,
      ];

      if (objectType === 'contact') {
        rows.push([
          ...baseFields,
          escapeCSV(record.firstName || ''),
          escapeCSV(record.lastName || ''),
          escapeCSV(record.email || ''),
          escapeCSV(record.phone || ''),
          escapeCSV(record.company || ''),
          escapeCSV(record.jobTitle || ''),
          record.createdAt || '',
          record.updatedAt || '',
        ].join(','));
      } else {
        rows.push([
          ...baseFields,
          escapeCSV(record.name || ''),
          escapeCSV(record.domain || ''),
          escapeCSV(record.phone || ''),
          escapeCSV(record.industry || ''),
          escapeCSV(record.city || ''),
          escapeCSV(record.state || ''),
          record.createdAt || '',
          record.updatedAt || '',
        ].join(','));
      }
    });
  }

  return rows.join('\n');
}

/**
 * Escape a value for CSV
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export duplicate groups to file
 */
export async function exportDuplicateGroups(options: ExportOptions): Promise<ExportResult> {
  console.log('=== Starting Export ===');
  console.log('Options:', options);

  try {
    const groups = getExportableGroups(options.objectType, options.status);

    if (groups.length === 0) {
      return {
        success: false,
        error: 'No duplicate groups found to export',
      };
    }

    // Generate file content
    const content = options.format === 'json'
      ? JSON.stringify(groups, null, 2)
      : groupsToCSV(groups, options.objectType);

    // Get save path from user
    const defaultPath = path.join(
      app.getPath('documents'),
      `hubspot-duplicates-${options.objectType}-${Date.now()}.${options.format || 'csv'}`
    );

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Duplicate Groups',
      defaultPath,
      filters: options.format === 'json'
        ? [{ name: 'JSON', extensions: ['json'] }]
        : [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (canceled || !filePath) {
      return {
        success: false,
        error: 'Export cancelled by user',
      };
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf-8');

    console.log(`=== Export Complete: ${filePath} ===`);
    console.log(`Exported ${groups.length} groups`);

    return {
      success: true,
      filePath,
      recordCount: groups.reduce((sum, g) => sum + g.recordCount, 0),
    };
  } catch (error) {
    console.error('Export failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}
