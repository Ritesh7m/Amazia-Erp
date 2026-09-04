// services/reset-db.ts
import { resetDatabase, fetchQuery, closeConnection } from '@/database';

async function main() {
  console.log('Starting Database Reset & Rebuild...');
  try {
    await resetDatabase();
    console.log('Database reset successfully! Normalized tables and views initialized.');

    // Verify active tables
    const tables = await fetchQuery<any>('SHOW TABLES;');
    console.log('\n--- Active Tables in DuckDB ---');
    console.table(tables);

    await closeConnection();
    process.exit(0);
  } catch (err: any) {
    console.error('Error during database reset:', err?.message || err);
    console.error(err?.stack);
    process.exit(1);
  }
}

main();