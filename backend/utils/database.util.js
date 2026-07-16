/**
 * MySQL database client.
 * This layer owns the connection pool lifecycle, health checks, reconnect behavior, and transaction wrapper.
 * It intentionally does not contain business CRUD methods or SQL queries.
 */
import mysql from "mysql2/promise";
import { databaseConfig } from "../config/database.config.js";
import { AppError } from "./app-error.util.js";
import { logger } from "./logger.util.js";

class DatabaseClient {
  constructor(config) {
    this.config = config;
    this.poolConfig = createPoolConfig(config);
    this.pool = null;
    this.reconnectTimer = null;
  }

  getPool() {
    if (!this.pool) {
      this.pool = mysql.createPool(this.poolConfig);
      logger.info("MySQL connection pool initialized.", {
        host: this.poolConfig.host,
        port: this.poolConfig.port,
        database: this.poolConfig.database,
        connectionLimit: this.poolConfig.connectionLimit
      });
    }

    return this.pool;
  }

  async getConnection() {
    try {
      return await withTimeout(
        this.getPool().getConnection(),
        this.config.acquireTimeout,
        "Timed out while acquiring a MySQL connection."
      );
    } catch (error) {
      logger.error("Unable to acquire MySQL connection.", error.message);
      this.scheduleReconnect();
      throw new AppError("Database connection is unavailable.", 503, "DATABASE_CONNECTION_UNAVAILABLE");
    }
  }

  async healthCheck() {
    let connection = null;

    try {
      connection = await withTimeout(
        this.getConnection(),
        this.config.healthCheckTimeout,
        "MySQL health check timed out."
      );
      await withTimeout(
        connection.ping(),
        this.config.healthCheckTimeout,
        "MySQL ping timed out."
      );

      return {
        healthy: true,
        message: "MySQL connection pool is healthy."
      };
    } catch (error) {
      logger.error("MySQL health check failed.", error.message);
      this.scheduleReconnect();

      return {
        healthy: false,
        message: error.message
      };
    } finally {
      connection?.release();
    }
  }

  async withTransaction(callback) {
    const connection = await this.getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      logger.error("MySQL transaction rolled back.", error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  async closePool() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
    logger.info("MySQL connection pool closed.");
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.reconnect();
    }, this.config.reconnectDelay);

    this.reconnectTimer.unref?.();
  }

  async reconnect() {
    try {
      await this.closePool();
      this.getPool();
      logger.info("MySQL connection pool re-created.");
    } catch (error) {
      logger.error("MySQL reconnect attempt failed.", error.message);
      this.scheduleReconnect();
    }
  }
}

export const databaseClient = new DatabaseClient(databaseConfig);

export async function withTransaction(callback) {
  return databaseClient.withTransaction(callback);
}

export async function checkDatabaseHealth() {
  return databaseClient.healthCheck();
}

export async function closeDatabasePool() {
  return databaseClient.closePool();
}

function withTimeout(promise, timeout, timeoutMessage) {
  let timer = null;

  const timeoutPromise = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeout);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

function createPoolConfig(config) {
  const {
    acquireTimeout,
    healthCheckTimeout,
    reconnectDelay,
    ...poolConfig
  } = config;

  return poolConfig;
}
