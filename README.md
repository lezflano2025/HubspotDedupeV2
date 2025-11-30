# HubSpot Deduplicator

A local-first desktop application for finding and merging duplicate contacts and companies in HubSpot.

## Tech Stack

- **Core**: Electron (latest), Node.js (Main Process), React + Vite (Renderer Process)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS + Shadcn/UI
- **Database**: better-sqlite3 (Synchronous)
- **Security**:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - IPC via `contextBridge`

## Project Structure

```
/src
  /main              # Electron main process
    main.ts          # Entry point
    preload.ts       # Preload script with contextBridge
    ipcHandlers.ts   # IPC message handlers
    /db              # Database operations
    /hubspot         # HubSpot API integration
    /dedup           # Deduplication logic
  /renderer          # React application
    /components      # React components
    /pages           # Page components
    App.tsx          # Root component
  /shared            # Shared types and constants
    types.ts         # TypeScript type definitions
    ipcChannels.ts   # IPC channel constants
```

## Getting Started

### Prerequisites

- Node.js (v20 or later)
- npm or yarn

### Installation

```bash
npm install
```

### Development

Run the application in development mode:

```bash
npm run dev
```

This will:
1. Start the Vite dev server for hot module replacement
2. Launch Electron with DevTools open
3. Enable auto-reload on file changes

### Building

Build the application for production:

```bash
npm run build
```

Compile platform-specific distributables:

```bash
# Windows
npm run compile:win

# macOS
npm run compile:mac

# Linux
npm run compile:linux

# All platforms
npm run compile
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build both main and renderer processes
- `npm run compile` - Build and package the application
- `npm start` - Run the built application

## Security Features

- **Context Isolation**: Enabled to prevent prototype pollution
- **Node Integration**: Disabled in renderer for security
- **Sandbox**: Enabled for renderer process
- **Safe IPC**: All communication via predefined channels through contextBridge

## Next Steps

1. Implement database operations with better-sqlite3
2. Add HubSpot OAuth authentication
3. Build contact/company fetching logic
4. Implement deduplication algorithms
5. Create UI components with Shadcn/UI
6. Add merge functionality

## License

MIT
