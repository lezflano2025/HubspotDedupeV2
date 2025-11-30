# Database Layer

This directory contains the complete database layer implementation using better-sqlite3.

## Architecture

```
/db
  database.ts           # Core connection and query functions
  schema.ts             # SQL schema definitions
  migrations.ts         # Migration system
  types.ts              # TypeScript type definitions
  index.ts              # Public API exports
  /repositories         # Repository pattern implementations
    CredentialRepository.ts
    ContactRepository.ts
    CompanyRepository.ts
    DuplicateGroupRepository.ts
    ImportBatchRepository.ts
    MergeHistoryRepository.ts
```

## Features

- **WAL Mode**: Write-Ahead Logging enabled for better performance
- **Foreign Keys**: Enabled for referential integrity
- **Indexes**: Optimized indexes on frequently queried columns
- **Type Safety**: Full TypeScript support with typed repositories
- **Transactions**: Support for atomic operations
- **Migrations**: Version-based schema migration system

## Database Schema

### Tables

1. **credentials** - Encrypted HubSpot API credentials
2. **import_batches** - Track data import operations
3. **contacts** - HubSpot contacts with indexed email
4. **companies** - HubSpot companies with indexed domain
5. **deals** - HubSpot deals
6. **duplicate_groups** - Groups of potential duplicates
7. **potential_matches** - Individual records in duplicate groups
8. **merge_history** - Audit trail of merge operations

## Usage Examples

### Initialize Database

```typescript
import { initializeDatabase, runDatabaseMigrations } from './db';

// Called automatically on app startup in main.ts
initializeDatabase();
runDatabaseMigrations();
```

### Using Repositories

```typescript
import { ContactRepository, CompanyRepository } from './db';

// Insert a contact
const contact = ContactRepository.insert({
  hs_id: '12345',
  email: 'john@example.com',
  first_name: 'John',
  last_name: 'Doe',
});

// Find contacts by email
const duplicates = ContactRepository.findByEmail('john@example.com');

// Bulk insert
const contacts = [...]; // array of contacts
ContactRepository.bulkInsert(contacts);

// Search contacts
const results = ContactRepository.search('john');
```

### Direct SQL Queries

```typescript
import { query, execute } from './db';

// Query data
const contacts = query<Contact>('SELECT * FROM contacts WHERE email = ?', ['test@example.com']);

// Execute statement
const result = execute('UPDATE contacts SET first_name = ? WHERE hs_id = ?', ['Jane', '12345']);
console.log(`Updated ${result.changes} rows`);
```

### Transactions

```typescript
import { transaction, ContactRepository } from './db';

const result = transaction(() => {
  const contact1 = ContactRepository.insert({ ... });
  const contact2 = ContactRepository.insert({ ... });
  return { contact1, contact2 };
});
```

### Duplicate Detection

```typescript
import { DuplicateGroupRepository } from './db';

// Create a duplicate group
const group = DuplicateGroupRepository.create({
  group_id: 'group-123',
  object_type: 'contact',
  confidence_level: 'high',
  status: 'pending',
});

// Add matches to the group
DuplicateGroupRepository.addMatch({
  group_id: 'group-123',
  record_hs_id: '12345',
  match_score: 0.95,
  matched_fields: JSON.stringify(['email', 'phone']),
});

// Get group with all matches
const groupWithMatches = DuplicateGroupRepository.getGroupWithMatches('group-123');
```

## Database Location

The database file is stored in the Electron user data directory:
- **Windows**: `%APPDATA%/hubspot-deduplicator/data/deduplicator.db`
- **macOS**: `~/Library/Application Support/hubspot-deduplicator/data/deduplicator.db`
- **Linux**: `~/.config/hubspot-deduplicator/data/deduplicator.db`

## Performance Optimizations

1. **WAL Mode**: Allows concurrent reads while writing
2. **Prepared Statements**: All queries use prepared statements for safety and performance
3. **Bulk Inserts**: Use transactions for bulk operations
4. **Indexes**: Strategic indexes on frequently queried columns
5. **Cache Size**: 2MB cache for better performance

## Migration System

The migration system tracks schema versions and applies updates automatically:

```typescript
// Current schema version is tracked in schema_version table
// Migrations are applied automatically on startup
// To add a new migration:
// 1. Update SCHEMA_VERSION in schema.ts
// 2. Add migration logic in migrations.ts runMigrations()
```

## Security Considerations

- Credentials should be encrypted before storing (TODO: implement encryption)
- Use parameterized queries to prevent SQL injection
- Database file permissions are managed by Electron's userData directory
