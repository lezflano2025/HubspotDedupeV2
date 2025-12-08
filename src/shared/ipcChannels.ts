/**
 * IPC Channel definitions for communication between Main and Renderer processes
 */

export const IPC_CHANNELS = {
  // Database operations
  DB_QUERY: 'db:query',
  DB_EXECUTE: 'db:execute',

  // HubSpot operations
  HUBSPOT_AUTHENTICATE: 'hubspot:authenticate',
  HUBSPOT_GET_CONNECTION_STATUS: 'hubspot:get-connection-status',
  HUBSPOT_DISCONNECT: 'hubspot:disconnect',
  HUBSPOT_FETCH_CONTACTS: 'hubspot:fetch-contacts',
  HUBSPOT_FETCH_COMPANIES: 'hubspot:fetch-companies',
  HUBSPOT_IMPORT_CONTACTS: 'hubspot:import-contacts',
  HUBSPOT_IMPORT_COMPANIES: 'hubspot:import-companies',

  // Deduplication operations
  DEDUP_RUN_ANALYSIS: 'dedup:run-analysis',
  DEDUP_GET_GROUPS: 'dedup:get-groups',
  DEDUP_GET_STATUS_COUNTS: 'dedup:get-status-counts',
  DEDUP_MERGE: 'dedup:merge',
  DEDUP_UPDATE_STATUS: 'dedup:update-status',

  // Export operations
  EXPORT_DUPLICATE_GROUPS: 'export:duplicate-groups',

  // Progress events
  PROGRESS_UPDATE: 'progress:update',

  // Data retrieval operations
  GET_CONTACTS: 'data:get-contacts',
  GET_COMPANIES: 'data:get-companies',

  // General
  APP_INFO: 'app:info',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
