import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import type { ConnectionStatus, AuthResult } from '../../shared/types';

export function ConnectPage() {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    hasStoredCredentials: false,
  });

  // Load connection status on mount
  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const loadConnectionStatus = async () => {
    try {
      const status = await window.api.hubspotGetConnectionStatus();
      setConnectionStatus(status);
    } catch (error) {
      console.error('Failed to load connection status:', error);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsLoading(true);

    try {
      const result: AuthResult = await window.api.hubspotAuthenticate(apiKey);

      if (result.success) {
        // Success! Update connection status
        setConnectionStatus({
          isConnected: true,
          hasStoredCredentials: true,
          portalId: result.portalId,
        });
        setApiKey(''); // Clear the input for security
      } else {
        setError(result.error || 'Failed to connect to HubSpot');
      }
    } catch (error) {
      console.error('Connection error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect from HubSpot?')) {
      return;
    }

    setIsLoading(true);

    try {
      await window.api.hubspotDisconnect();
      setConnectionStatus({
        isConnected: false,
        hasStoredCredentials: false,
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      setError(error instanceof Error ? error.message : 'Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  };

  if (connectionStatus.isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connected to HubSpot</h2>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Portal ID: <span className="font-mono font-semibold">{connectionStatus.portalId}</span>
            </p>

            <div className="space-y-3">
              <Button variant="primary" className="w-full" onClick={() => window.location.reload()}>
                Continue to Dashboard
              </Button>

              <Button variant="danger" className="w-full" onClick={handleDisconnect} disabled={isLoading}>
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Connect to HubSpot
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Enter your HubSpot API key to get started
          </p>
        </div>

        <form onSubmit={handleConnect} className="space-y-6">
          <Input
            type="password"
            label="HubSpot API Key"
            placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            error={error}
            helperText="Your API key is encrypted and stored securely"
            disabled={isLoading}
            autoFocus
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Connect
          </Button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            How to get your API key:
          </h3>
          <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
            <li>Log in to your HubSpot account</li>
            <li>Go to Settings → Integrations → Private Apps</li>
            <li>Create a new private app or use an existing one</li>
            <li>Copy the access token</li>
          </ol>
        </div>

        {connectionStatus.hasStoredCredentials && !connectionStatus.isConnected && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Previous credentials found but could not reconnect. Please enter a new API key.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
