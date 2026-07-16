/**
 * MySQL configuration.
 * This file only normalizes database environment variables; no connection is opened and no SQL is executed here.
 */
export const databaseConfig = Object.freeze({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "n_l_shop",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  maxIdle: Number(process.env.DB_MAX_IDLE || 10),
  idleTimeout: Number(process.env.DB_IDLE_TIMEOUT || 60000),
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT || 10000),
  healthCheckTimeout: Number(process.env.DB_HEALTH_CHECK_TIMEOUT || 3000),
  reconnectDelay: Number(process.env.DB_RECONNECT_DELAY || 2000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: "utf8mb4",
  timezone: "Z"
});
