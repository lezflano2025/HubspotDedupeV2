import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import type { ElectronAPI } from '../shared/types';

/**
 * Preload script that exposes a safe API to the renderer process
 * Uses contextBridge to ensure security with contextIsolation enabled
 */

const api: ElectronAPI = {
  // Database operations
  dbQuery: async <T = unknown>(sql: string, params?: unknown[]) => {
    return ipcRenderer.invoke(IPC_CHANNELS.DB_QUERY, sql, params) as Promise<T[]>;
  },

  dbExecute: async (sql: string, params?: unknown[]) => {
    return ipcRenderer.invoke(IPC_CHANNELS.DB_EXECUTE, sql, params);
  },

  // HubSpot operations
  hubspotAuthenticate: async (apiKey: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.HUBSPOT_AUTHENTICATE, apiKey);
  },

  hubspotGetConnectionStatus: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.HUBSPOT_GET_CONNECTION_STATUS);
  },

  hubspotDisconnect: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.HUBSPOT_DISCONNECT);
  },

  hubspotFetchContacts: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.HUBSPOT_FETCH_CONTACTS);
  },

  hubspotFetchCompanies: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.HUBSPOT_FETCH_COMPANIES);
  },

  hubspotImportContacts: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.HUBSPOT_IMPORT_CONTACTS);
  },

  hubspotImportCompanies: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.HUBSPOT_IMPORT_COMPANIES);
  },

  // Deduplication operations
  dedupRunAnalysis: async (type: 'contact' | 'company') => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEDUP_RUN_ANALYSIS, type);
  },

  dedupGetGroups: async (type: 'contact' | 'company', status?: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEDUP_GET_GROUPS, type, status);
  },

  dedupGetStatusCounts: async (type: 'contact' | 'company') => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEDUP_GET_STATUS_COUNTS, type);
  },

  dedupMerge: async (
    groupId: string,
    primaryId: string,
    options?: { dryRun?: boolean; createBackup?: boolean }
  ) => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEDUP_MERGE, groupId, primaryId, options);
  },

  dedupUpdateGroupStatus: async (
    groupId: string,
    status: 'pending' | 'reviewed' | 'merged' | string,
    goldenHsId?: string
  ) => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEDUP_UPDATE_STATUS, groupId, status, goldenHsId);
  },

  // Data retrieval operations
  getContacts: async (limit?: number, offset?: number) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_CONTACTS, limit, offset);
  },

  getCompanies: async (limit?: number, offset?: number) => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_COMPANIES, limit, offset);
  },

  // General
  getAppInfo: async () => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_INFO);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);
