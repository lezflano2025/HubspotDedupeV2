const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'hubspot-deduplicator',
  'data',
  'deduplicator.db'
);

console.log('Testing contact insert...');

try {
  const db = new Database(dbPath);

  // Try to insert a test contact
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO contacts (
      hs_id, first_name, last_name, email, phone, company, job_title,
      created_at, updated_at, properties
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  console.log('Attempting insert...');
  const result = stmt.run(
    '12345',
    'Test',
    'User',
    'test@example.com',
    null,
    null,
    null,
    null,
    null,
    '{}'
  );

  console.log('Insert successful!');
  console.log('Changes:', result.changes);
  console.log('Last insert rowid:', result.lastInsertRowid);

  // Verify it was saved
  const verify = db.prepare('SELECT * FROM contacts WHERE hs_id = ?').get('12345');
  console.log('Verified:', verify);

  // Clean up
  db.prepare('DELETE FROM contacts WHERE hs_id = ?').run('12345');
  console.log('Test contact deleted');

  db.close();
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
