/**
 * MySQL configuration.
 * This file only normalizes database environment variables; no connection is opened and no SQL is executed here.
 */
const railwayUrl = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || "";
const railwayConfig = parseMysqlUrl(railwayUrl);

export const databaseConfig = Object.freeze({
  host: process.env.DB_HOST || railwayConfig.host || "127.0.0.1",
  port: Number(process.env.DB_PORT || railwayConfig.port || 3306),
  user: process.env.DB_USER || railwayConfig.user || "root",
  password: process.env.DB_PASSWORD || railwayConfig.password || "",
  database: process.env.DB_NAME || railwayConfig.database || "n_l_shop",
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
  timezone: "Z",
  source: railwayConfig.source || (process.env.DB_HOST || process.env.DB_NAME ? "DB_*" : "default")
});

function parseMysqlUrl(value) {
  if (!value) {
    return {};
  }

  try {
    const url = new URL(value);
    if (!["mysql:", "mysql2:"].includes(url.protocol)) {
      return {};
    }

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username || ""),
      password: decodeURIComponent(url.password || ""),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      source: process.env.MYSQL_URL ? "MYSQL_URL" : process.env.DATABASE_URL ? "DATABASE_URL" : "MYSQL_PUBLIC_URL"
    };
  } catch {
    return {};
  }
}
