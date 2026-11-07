import { createBackup, listBackups } from '../server/services/backup.js';

const [command] = process.argv.slice(2);

if (command === 'list') {
  const items = await listBackups();
  if (items.length === 0) console.log('Belum ada backup.');
  for (const b of items) console.log(`${b.created_at}  ${(b.size / 1024 / 1024).toFixed(2)} MB  ${b.name}`);
} else {
  const backup = await createBackup({ reason: 'manual', username: 'cli' });
  console.log(`Backup dibuat: ${backup.name} (${(backup.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log('Tersimpan di bucket Storage "backups" pada proyek Supabase Anda. Untuk memulihkan, gunakan menu Backup di dashboard admin.');
}
