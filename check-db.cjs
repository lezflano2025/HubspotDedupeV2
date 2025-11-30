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

console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });

  const contactCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get();
  console.log('Total contacts in database:', contactCount.count);

  const companyCount = db.prepare('SELECT COUNT(*) as count FROM companies').get();
  console.log('Total companies in database:', companyCount.count);

  const batchCount = db.prepare('SELECT COUNT(*) as count FROM import_batches').get();
  console.log('Total import batches:', batchCount.count);

  // Get last 3 import batches
  const batches = db.prepare(`
    SELECT batch_id, object_type, total_count, success_count, error_count, status, timestamp
    FROM import_batches
    ORDER BY timestamp DESC
    LIMIT 3
  `).all();

  console.log('\nRecent import batches:');
  batches.forEach(batch => {
    console.log(`  ${batch.timestamp} - ${batch.object_type}: fetched=${batch.total_count}, saved=${batch.success_count}, errors=${batch.error_count}, status=${batch.status}`);
  });

  // Sample a few contacts
  const sampleContacts = db.prepare('SELECT hs_id, first_name, last_name, email FROM contacts LIMIT 3').all();
  console.log('\nSample contacts:');
  sampleContacts.forEach(c => {
    console.log(`  ${c.hs_id}: ${c.first_name} ${c.last_name} (${c.email})`);
  });

  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
