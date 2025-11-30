/**
 * HubSpot module exports
 */

export { HubSpotApiClient, initializeHubSpotClient, getHubSpotClient, clearHubSpotClient } from './client';

export {
  authenticateHubSpot,
  loadStoredCredentials,
  disconnectHubSpot,
  getConnectionStatus,
  isConnected,
  requireHubSpotClient,
} from './auth';

export type { AuthenticateResult, ConnectionStatus } from './auth';
