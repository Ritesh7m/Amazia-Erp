// instrumentation.ts
// This file runs once when the Next.js server starts.
// It initializes the DuckDB database and schedules background cron jobs.

declare global {
  var __cronSchedulerInitialized: boolean | undefined;
}

export async function register() {
  // Only run on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    // 1. Initialize DuckDB schema (safe — getDbInstance uses globalThis singleton)
    const { initializeDatabase } = await import("@/database");
    await initializeDatabase();
    console.log("[System] DuckDB initialized successfully.");
  } catch (error) {
    console.error("[System] Failed to initialize DuckDB:", error);
    // Don't throw — let the app start even if DB init fails,
    // individual API routes will fail gracefully.
    return;
  }

  // 2. Guard against duplicate cron registration on HMR (Turbopack hot reload)
  if (globalThis.__cronSchedulerInitialized) {
    console.log("[System] Cron scheduler already initialized, skipping duplicate registration.");
    return;
  }
  globalThis.__cronSchedulerInitialized = true;

  try {
    // 3. Schedule background inventory sync (every 6 hours) for testing use 2 min "*/2 * * * *"
    const cron = (await import("node-cron")).default;
    const { runInventorySync } = await import("@/services/inventorySync");

    cron.schedule(
      // "*/2 * * * *",
      "0 */6 * * *",
      async () => {
        console.log(`[Scheduler] Running inventory sync at ${new Date().toISOString()}`);
        try {
          await runInventorySync();
          console.log("[Scheduler] Inventory sync completed.");
        } catch (err) {
          console.error("[Scheduler] Inventory sync failed:", err);
        }
      },

      { timezone: "Asia/Kolkata" }
    );

    // 4. Schedule Shopify / Other-Store Sales Sync (daily at 11:00 AM Asia/Kolkata per Section 8)
    try {
      const syncEnabled = process.env.SHOPIFY_SYNC_ENABLED !== 'false';
      const syncHour = process.env.SHOPIFY_SYNC_HOUR || '11';
      const timezone = process.env.SHOPIFY_SYNC_TIMEZONE || 'Asia/Kolkata';

      if (syncEnabled) {
        const { ShopifySyncService } = await import('@/services/shopifySync');
        const cronSchedule = `0 ${syncHour} * * *`;

        cron.schedule(
          cronSchedule,
          async () => {
            console.log(`[Scheduler] Running daily Shopify sales sync at ${new Date().toISOString()}...`);
            try {
              const res = await ShopifySyncService.runSync();
              console.log(`[Scheduler] Daily Shopify sales sync completed: ${res.message}`);
            } catch (err) {
              console.error('[Scheduler] Daily Shopify sales sync failed:', err);
            }
          },
          { timezone }
        );
        console.log(`[Scheduler] Shopify sales sync registered (${cronSchedule} ${timezone}).`);
      }
    } catch (err) {
      console.warn('[System] Shopify scheduler not available:', err);
    }

    // 5. Schedule database backups (daily at 2 AM)
    try {
      const { runBackupWorkflow } = await import("@/lib/backup/backupService");
      const { backupConfig } = await import("@/lib/backup/config");

      cron.schedule(backupConfig.rules.cronSchedule, async () => {
        console.log("[Scheduler] Running backup workflow...");
        try {
          await runBackupWorkflow();
        } catch (err) {
          console.error("[Scheduler] Backup workflow failed:", err);
        }
      });
    } catch (err) {
      // Backup module is optional — don't crash if it fails
      console.warn("[System] Backup scheduler not available:", err);
    }

    console.log("[System] All cron schedulers registered successfully.");
  } catch (error) {
    console.error("[System] Failed to set up cron schedulers:", error);
  }
}
