import { store } from '../services/store.js';

try {
  const backup = await store.createBackup('manual-cli');
  if (!backup) {
    console.error('No database file exists to back up.');
    process.exitCode = 1;
  } else if (backup.driver === 'postgresql') {
    console.error('PostgreSQL backup was not created by this command. Use pg_dump or your database provider backup service.');
    process.exitCode = 2;
  } else if (backup.filePath) {
    console.log(`Database backup created: ${backup.filePath}`);
  } else {
    console.error('The storage driver did not return a backup file path; no backup was verified.');
    process.exitCode = 1;
  }
} catch (err) {
  console.error('Database backup failed:', err.message);
  process.exitCode = 1;
}
