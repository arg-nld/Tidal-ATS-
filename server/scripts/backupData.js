import { store } from '../services/store.js';

try {
  const backup = store.createBackup('manual-cli');
  if (!backup) {
    console.error('No database file exists to back up.');
    process.exitCode = 1;
  } else {
    console.log(`Database backup created: ${backup.filePath}`);
  }
} catch (err) {
  console.error('Database backup failed:', err.message);
  process.exitCode = 1;
}
