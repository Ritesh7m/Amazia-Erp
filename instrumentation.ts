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

    // 4. Schedule database backups (daily at 2 AM)
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