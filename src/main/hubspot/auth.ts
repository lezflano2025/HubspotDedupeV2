import { initializeHubSpotClient, getHubSpotClient, clearHubSpotClient } from './client';
import { CredentialRepository } from '../db';
import { encrypt, decrypt, sanitizeForLog } from '../utils/security';

/**
 * HubSpot authentication and credential management
 */

export interface AuthenticateResult {
  success: boolean;
  portalId?: string;
  error?: string;
  isAuthenticated: boolean;
}

export interface ConnectionStatus {
  isConnected: boolean;
  portalId?: string;
  hasStoredCredentials: boolean;
}

/**
 * Authenticate with HubSpot using an API key or access token
 * Tests the connection, retrieves portal info, encrypts and stores credentials
 */
export async function authenticateHubSpot(
  apiKeyOrToken: string,
  type: 'apiKey' | 'accessToken' = 'apiKey'
): Promise<AuthenticateResult> {
  try {
    console.log(`Authenticating with HubSpot using ${type}...`);
    console.log(`Token: ${sanitizeForLog(apiKeyOrToken)}`);

    // Initialize the client
    // Note: HubSpot Private App tokens (starting with 'pat-') should use accessToken
    // Legacy API keys use apiKey parameter
    const isPrivateAppToken = apiKeyOrToken.startsWith('pat-');
    const client = isPrivateAppToken || type === 'accessToken'
      ? initializeHubSpotClient({ accessToken: apiKeyOrToken })
      : initializeHubSpotClient({ apiKey: apiKeyOrToken });

    // Test the connection by fetching account info
    let accountInfo;
    try {
      accountInfo = await client.getAccountInfo();
      console.log('Account info response:', JSON.stringify(accountInfo, null, 2));
    } catch (error: unknown) {
      console.error('Failed to connect to HubSpot:', error);

      // Clear the failed client
      clearHubSpotClient();

      return {
        success: false,
        isAuthenticated: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to connect to HubSpot. Please check your API key/token.',
      };
    }

    if (!accountInfo || !accountInfo.portalId) {
      console.error('Invalid account info response:', accountInfo);
      clearHubSpotClient();
      return {
        success: false,
        isAuthenticated: false,
        error: 'Failed to retrieve portal information from HubSpot',
      };
    }

    const portalId = accountInfo.portalId.toString();
    console.log(`Successfully connected to HubSpot portal: ${portalId}`);

    // Encrypt the credentials
    const encryptedToken = encrypt(apiKeyOrToken);

    // Store credentials in database
    // Note: For API keys, we don't have refresh tokens or expiry
    // For OAuth access tokens, these should be provided separately
    const expiresAt = type === 'apiKey' ? Date.now() + 365 * 24 * 60 * 60 * 1000 : Date.now() + 6 * 60 * 60 * 1000; // API key: 1 year, Access token: 6 hours

    CredentialRepository.upsert({
      portal_id: portalId,
      access_token: encryptedToken,
      refresh_token: '', // Will be implemented with OAuth
      expires_at: expiresAt,
      scope: type === 'apiKey' ? 'api_key' : undefined,
    });

    console.log('Credentials encrypted and stored successfully');

    return {
      success: true,
      portalId,
      isAuthenticated: true,
    };
  } catch (error) {
    console.error('Authentication error:', error);

    // Clear any partially initialized client
    clearHubSpotClient();

    return {
      success: false,
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Load stored credentials and initialize the HubSpot client
 */
export async function loadStoredCredentials(): Promise<ConnectionStatus> {
  try {
    const credential = CredentialRepository.getCurrent();

    if (!credential) {
      console.log('No stored credentials found');
      return {
        isConnected: false,
        hasStoredCredentials: false,
      };
    }

    // Check if credentials are expired
    if (CredentialRepository.isExpired(credential)) {
      console.log('Stored credentials are expired');
      // TODO: Implement token refresh for OAuth
      return {
        isConnected: false,
        hasStoredCredentials: true,
        portalId: credential.portal_id,
      };
    }

    // Decrypt the access token
    const decryptedToken = decrypt(credential.access_token);

    // Initialize the client
    const isApiKey = credential.scope === 'api_key';
    const client = isApiKey
      ? initializeHubSpotClient({ apiKey: decryptedToken })
      : initializeHubSpotClient({ accessToken: decryptedToken });

    // Verify the connection is still valid
    try {
      await client.getAccountInfo();

      console.log(`Successfully loaded credentials for portal: ${credential.portal_id}`);

      return {
        isConnected: true,
        hasStoredCredentials: true,
        portalId: credential.portal_id,
      };
    } catch (error) {
      console.error('Stored credentials are invalid:', error);

      // Clear the invalid client
      clearHubSpotClient();

      return {
        isConnected: false,
        hasStoredCredentials: true,
        portalId: credential.portal_id,
      };
    }
  } catch (error) {
    console.error('Error loading stored credentials:', error);
    return {
      isConnected: false,
      hasStoredCredentials: false,
    };
  }
}

/**
 * Disconnect from HubSpot (clear credentials)
 */
export async function disconnectHubSpot(): Promise<void> {
  const credential = CredentialRepository.getCurrent();

  if (credential) {
    CredentialRepository.delete(credential.portal_id);
    console.log(`Deleted credentials for portal: ${credential.portal_id}`);
  }

  clearHubSpotClient();
  console.log('Disconnected from HubSpot');
}

/**
 * Get current connection status
 */
export function getConnectionStatus(): ConnectionStatus {
  const client = getHubSpotClient();
  const credential = CredentialRepository.getCurrent();

  return {
    isConnected: client !== null,
    hasStoredCredentials: credential !== null,
    portalId: credential?.portal_id,
  };
}

/**
 * Check if currently connected to HubSpot
 */
export function isConnected(): boolean {
  return getHubSpotClient() !== null;
}

/**
 * Get the current HubSpot client (throws if not connected)
 */
export function requireHubSpotClient() {
  const client = getHubSpotClient();

  if (!client) {
    throw new Error('Not connected to HubSpot. Please authenticate first.');
  }

  return client;
}
