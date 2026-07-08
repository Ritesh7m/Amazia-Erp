export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeDatabase } = await import('./database/index');
    
    try {
      await initializeDatabase();
      console.log('[Amazia ERP] DuckDB Database initialized successfully.');
    } catch (error) {
      console.error('[Amazia ERP] Failed to initialize DuckDB:', error);
    }
  }
}