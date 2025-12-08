import { ipcMain, app } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import { query, execute, DuplicateGroupRepository, ContactRepository, CompanyRepository } from './db';
import { authenticateHubSpot, getConnectionStatus, disconnectHubSpot } from './hubspot/auth';
import { runContactDeduplication, runCompanyDeduplication } from './dedup';
import { executeMerge } from './hubspot/merge';
import { importContacts, importCompanies } from './hubspot/import';
import { exportDuplicateGroups } from './export';
import type { ExportOptions } from '../shared/types';

/**
 * IPC handlers for communication between Main and Renderer processes
 */

// Database operations
ipcMain.handle(IPC_CHANNELS.DB_QUERY, async (_event, sql: string, params?: unknown[]) => {
  try {
    console.log('DB Query:', sql);
    return query(sql, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.DB_EXECUTE, async (_event, sql: string, params?: unknown[]) => {
  try {
    console.log('DB Execute:', sql);
    return execute(sql, params);
  } catch (error) {
    console.error('Database execute error:', error);
    throw error;
  }
});

// HubSpot operations
ipcMain.handle(IPC_CHANNELS.HUBSPOT_AUTHENTICATE, async (_event, apiKey: string) => {
  try {
    console.log('HubSpot authentication requested');
    const result = await authenticateHubSpot(apiKey, 'apiKey');
    return result;
  } catch (error) {
    console.error('HubSpot authentication error:', error);
    return {
      success: false,
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
});

ipcMain.handle(IPC_CHANNELS.HUBSPOT_GET_CONNECTION_STATUS, async () => {
  try {
    const status = getConnectionStatus();
    return status;
  } catch (error) {
    console.error('Error getting connection status:', error);
    return {
      isConnected: false,
      hasStoredCredentials: false,
    };
  }
});

ipcMain.handle(IPC_CHANNELS.HUBSPOT_DISCONNECT, async () => {
  try {
    await disconnectHubSpot();
  } catch (error) {
    console.error('Error disconnecting from HubSpot:', error);
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.HUBSPOT_FETCH_CONTACTS, async () => {
  // TODO: Implement fetching contacts
  console.log('Fetch contacts requested');
  return [];
});

ipcMain.handle(IPC_CHANNELS.HUBSPOT_FETCH_COMPANIES, async () => {
  // TODO: Implement fetching companies
  console.log('Fetch companies requested');
  return [];
});

// Deduplication operations
ipcMain.handle(IPC_CHANNELS.DEDUP_RUN_ANALYSIS, async (_event, type: 'contact' | 'company') => {
  try {
    console.log(`Starting deduplication analysis for ${type}...`);

    const result =
      type === 'contact' ? await runContactDeduplication() : await runCompanyDeduplication();

    console.log(`Deduplication analysis complete for ${type}:`, result);
    return result;
  } catch (error) {
    console.error('Deduplication analysis error:', error);
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.DEDUP_GET_GROUPS, async (_event, type: 'contact' | 'company', status?: string) => {
  try {
    const groups = DuplicateGroupRepository.findByObjectType(type, status);

    // Get matches for each group
    const groupsWithMatches = groups.map((group) => {
      const matches = DuplicateGroupRepository.getMatches(group.group_id);

      // Fetch full records for each match
      const records = matches.map((m) => {
        if (type === 'contact') {
          const contact = ContactRepository.findByHsId(m.record_hs_id);
          if (contact) {
            // Parse properties JSON if it exists
            let parsedProps = {};
            try {
              parsedProps = contact.properties ? JSON.parse(contact.properties) : {};
            } catch (e) {
              console.error('Failed to parse contact properties:', e);
            }

            return {
              hs_id: contact.hs_id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              email: contact.email,
              phone: contact.phone,
              company: contact.company,
              job_title: contact.job_title,
              created_at: contact.created_at,
              updated_at: contact.updated_at,
              ...parsedProps,
            };
          }
        } else {
          const company = CompanyRepository.findByHsId(m.record_hs_id);
          if (company) {
            // Parse properties JSON if it exists
            let parsedProps = {};
            try {
              parsedProps = company.properties ? JSON.parse(company.properties) : {};
            } catch (e) {
              console.error('Failed to parse company properties:', e);
            }

            return {
              hs_id: company.hs_id,
              name: company.name,
              domain: company.domain,
              phone: company.phone,
              city: company.city,
              state: company.state,
              country: company.country,
              industry: company.industry,
              created_at: company.created_at,
              updated_at: company.updated_at,
              ...parsedProps,
            };
          }
        }
        return { hs_id: m.record_hs_id };
      }).filter(r => r !== null);

      // Parse field scores if available (stored as JSON in matched_fields for now)
      let fieldScores: Array<{field: string; score: number}> = [];
      try {
        const matchedFieldsData = matches[0]?.matched_fields ? JSON.parse(matches[0].matched_fields) : null;
        if (Array.isArray(matchedFieldsData)) {
          // Old format: array of field names
          fieldScores = [];
        } else if (matchedFieldsData && typeof matchedFieldsData === 'object' && matchedFieldsData.scores) {
          // New format: object with scores
          fieldScores = matchedFieldsData.scores;
        }
      } catch (e) {
        console.error('Failed to parse field scores:', e);
      }

      return {
        id: group.group_id,
        type: group.object_type,
        records,
        similarityScore: matches[0]?.match_score || 0,
        matchedFields: matches[0]?.matched_fields
          ? typeof JSON.parse(matches[0].matched_fields) === 'object' && !Array.isArray(JSON.parse(matches[0].matched_fields))
            ? JSON.parse(matches[0].matched_fields).fields || []
            : JSON.parse(matches[0].matched_fields)
          : [],
        fieldScores,
        status: group.status,
        confidenceLevel: (group.confidence_level as 'high' | 'medium' | 'low') || undefined,
        goldenRecordId: group.golden_hs_id || undefined,
      };
    });

    return groupsWithMatches;
  } catch (error) {
    console.error('Error getting duplicate groups:', error);
    throw error;
  }
});

// RESOLUTION: Added both the Update Status handler (Codex) and the Get Status Counts handler (Main)

ipcMain.handle(
  IPC_CHANNELS.DEDUP_UPDATE_STATUS,
  async (_event, groupId: string, status: string, goldenHsId?: string) => {
    try {
      const updated = DuplicateGroupRepository.updateStatus(groupId, status, goldenHsId);
      return updated;
    } catch (error) {
      console.error('Error updating duplicate group status:', error);
      throw error;
    }
  }
);

ipcMain.handle(IPC_CHANNELS.DEDUP_GET_STATUS_COUNTS, async (_event, type: 'contact' | 'company') => {
  try {
    const counts = DuplicateGroupRepository.countByStatus(type);
    const pending = counts.pending || 0;
    const reviewed = counts.reviewed || 0;
    const merged = counts.merged || 0;
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    return {
      ...counts,
      pending,
      reviewed,
      merged,
      total,
    };
  } catch (error) {
    console.error('Error getting duplicate group status counts:', error);
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.DEDUP_MERGE, async (_event, groupId: string, primaryId: string) => {
  try {
    console.log(`Merge requested: group=${groupId}, primary=${primaryId}`);

    const result = await executeMerge({
      groupId,
      primaryRecordId: primaryId,
      createBackup: true,
    });

    if (result.success) {
      console.log(`Merge successful: merged ${result.mergedIds.length} records`);
    } else {
      console.error(`Merge failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error('Merge operation error:', error);
    return {
      success: false,
      primaryId,
      mergedIds: [],
      error: error instanceof Error ? error.message : 'Merge operation failed',
    };
  }
});

// Export operations
ipcMain.handle(IPC_CHANNELS.EXPORT_DUPLICATE_GROUPS, async (_event, options: ExportOptions) => {
  try {
    console.log('Export duplicate groups requested:', options);
    const result = await exportDuplicateGroups(options);
    return result;
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
});

// Import operations
ipcMain.handle(IPC_CHANNELS.HUBSPOT_IMPORT_CONTACTS, async (_event) => {
  try {
    console.log('Starting contact import...');
    const result = await importContacts();
    console.log('Contact import complete:', result);
    return result;
  } catch (error) {
    console.error('Contact import error:', error);
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.HUBSPOT_IMPORT_COMPANIES, async (_event) => {
  try {
    console.log('Starting company import...');
    const result = await importCompanies();
    console.log('Company import complete:', result);
    return result;
  } catch (error) {
    console.error('Company import error:', error);
    throw error;
  }
});

// Data retrieval operations
ipcMain.handle(IPC_CHANNELS.GET_CONTACTS, async (_event, limit?: number, offset?: number) => {
  try {
    const contacts = ContactRepository.getAll(limit, offset);
    const count = ContactRepository.count();
    return { contacts, count };
  } catch (error) {
    console.error('Error getting contacts:', error);
    throw error;
  }
});

ipcMain.handle(IPC_CHANNELS.GET_COMPANIES, async (_event, limit?: number, offset?: number) => {
  try {
    const companies = CompanyRepository.getAll(limit, offset);
    const count = CompanyRepository.count();
    return { companies, count };
  } catch (error) {
    console.error('Error getting companies:', error);
    throw error;
  }
});

// General
ipcMain.handle(IPC_CHANNELS.APP_INFO, async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
  };
});