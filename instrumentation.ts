export async function register() {
  // Only run on the Node.js runtime (not Edge or browser)
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Initialize DuckDB
  try {
    const { initializeDatabase } = await import("./database/index");
    await initializeDatabase();
    console.log("[Amazia ERP] DuckDB Database initialized successfully.");
  } catch (error) {
    console.error("[Amazia ERP] Failed to initialize DuckDB:", error);
  }

  // Initialize Cron Scheduler
  try {
    const cron = await import("node-cron");
    const { runInventorySync } = await import("./services/inventorySync");

    console.log("[System] Internal Cron Scheduler Initialized.");

    // Runs every 6 hours "0 */6 * * *"
    cron.default.schedule("*/2 * * * *", async () => { 
      console.log("-----------------------------------");
      console.log("[Cron]  Automatic Trigger Activated!");

      try {
        await runInventorySync();
        console.log("[Cron]  Automatic Inventory Sync Completed.");
      } catch (error) {
        console.error("[Cron]  Automatic Sync Failed:", error);
      }
    });

    // Uncomment this if you want to run once immediately on server startup.
    /*
    console.log("[System]  Running initial inventory sync...");
    try {
      await runInventorySync();
      console.log("[System]  Initial inventory sync completed.");
    } catch (error) {
      console.error("[System]  Initial inventory sync failed:", error);
    }
    */
  } catch (error) {
    console.error("[System] Failed to initialize cron scheduler:", error);
  }
}