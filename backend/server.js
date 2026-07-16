/**
 * Server entry point.
 * This file starts the HTTP process and centralizes shutdown handling.
 */
import app from "./app.js";
import { appConfig } from "./config/app.config.js";
import { closeDatabasePool } from "./utils/database.util.js";
import { logger } from "./utils/logger.util.js";

const server = app.listen(appConfig.port, () => {
  logger.info(`Backend server is running on port ${appConfig.port} in ${appConfig.env} mode.`);
});

async function shutdown(signal) {
  logger.info(`${signal} received. Closing server gracefully.`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out. Forcing process exit.");
    process.exit(1);
  }, appConfig.shutdownTimeoutMs);

  server.close(async () => {
    clearTimeout(forceExitTimer);
    await closeDatabasePool();
    logger.info("HTTP server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection.", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception.", error);
  process.exit(1);
});
