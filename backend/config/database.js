/**
 * MySQL connection configuration.
 * It creates a shared mysql2 promise pool for modules that need direct database access.
 */
import mysql from "mysql2/promise";
import { databaseConfig } from "./database.config.js";

const {
  acquireTimeout,
  healthCheckTimeout,
  reconnectDelay,
  ...poolConfig
} = databaseConfig;

export const databasePool = mysql.createPool(poolConfig);

export async function testDatabaseConnection() {
  const connection = await databasePool.getConnection();

  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}

export { databaseConfig };
