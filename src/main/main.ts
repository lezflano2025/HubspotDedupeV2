import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initializeDatabase, closeDatabase, runDatabaseMigrations, verifyDatabaseIntegrity } from './db';
import { loadStoredCredentials } from './hubspot/auth';

/**
 * Main process entry point for HubSpot Deduplicator
 */

let mainWindow: BrowserWindow | null = null;

const isDevelopment = process.env.NODE_ENV === 'development';

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false, // Don't show until ready-to-show event
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the renderer
  if (isDevelopment) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle events
app.whenReady().then(() => {
  // Initialize database
  try {
    console.log('Initializing database...');
    initializeDatabase();
    runDatabaseMigrations();
    verifyDatabaseIntegrity();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    app.quit();
    return;
  }

  // Import IPC handlers
  import('./ipcHandlers');

  // Load stored HubSpot credentials if available
  loadStoredCredentials()
    .then((status) => {
      if (status.isConnected) {
        console.log(`Restored HubSpot connection to portal: ${status.portalId}`);
      } else if (status.hasStoredCredentials) {
        console.log('Stored credentials found but connection could not be restored');
      } else {
        console.log('No stored HubSpot credentials found');
      }
    })
    .catch((error) => {
      console.error('Error loading stored credentials:', error);
    });

  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up on quit
app.on('will-quit', () => {
  console.log('Closing database connection...');
  closeDatabase();
});
