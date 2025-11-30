import React, { useState, useEffect } from 'react';
import { ConnectPage } from './pages/ConnectPage';
import { ResultsPage } from './pages/ResultsPage';
import type { ConnectionStatus } from '../shared/types';

function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const status = await window.api.hubspotGetConnectionStatus();
      setConnectionStatus(status);
    } catch (error) {
      console.error('Failed to check connection status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Show ConnectPage if not connected
  if (!connectionStatus?.isConnected) {
    return <ConnectPage />;
  }

  // Show ResultsPage if connected
  return <ResultsPage />;
}

export default App;
