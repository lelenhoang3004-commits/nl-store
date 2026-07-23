/**
 * Production-ready logger utility without extra dependencies.
 * It writes structured logs to daily files and mirrors logs to console when enabled.
 */
import fs from "node:fs";
import path from "node:path";
import { appConfig } from "../config/app.config.js";

const LOG_LEVELS = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
});

const LOG_FILES = Object.freeze({
  request: "request",
  error: "error",
  sql: "sql",
  warning: "warning",
  debug: "debug",
  application: "application"
});

const SENSITIVE_KEYS = ["password", "token", "authorization", "cookie", "secret", "refreshToken"];

ensureLogDirectory();
cleanupExpiredLogs();

export const logger = Object.freeze({
  request(message, meta = null) {
    writeLog("info", "request", message, meta);
  },

  sql(message, meta = null) {
    writeLog("debug", "sql", message, meta);
  },

  debug(message, meta = null) {
    writeLog("debug", "debug", message, meta);
  },

  info(message, meta = null) {
    writeLog("info", "application", message, meta);
  },

  warn(message, meta = null) {
    writeLog("warn", "warning", message, meta);
  },

  error(message, meta = null) {
    writeLog("error", "error", message, meta);
  }
});

function writeLog(level, channel, message, meta) {
  if (!shouldWrite(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    environment: appConfig.env,
    level,
    channel,
    message,
    meta: sanitizeMeta(meta)
  };
  const line = `${JSON.stringify(payload)}\n`;

  if (appConfig.logToFile) {
    appendToDailyLog(channel, line);
  }

  if (appConfig.logToConsole) {
    writeToConsole(level, payload);
  }
}

function shouldWrite(level) {
  const activeLevel = LOG_LEVELS[appConfig.logLevel] ?? LOG_LEVELS.info;
  const currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;

  return currentLevel <= activeLevel;
}

function appendToDailyLog(channel, line) {
  const logFileName = LOG_FILES[channel] || LOG_FILES.application;
  const filePath = path.join(appConfig.logsPath, `${logFileName}-${getCurrentDateKey()}.log`);

  fs.appendFile(filePath, line, (error) => {
    if (error) {
      writeToConsole("error", {
        timestamp: new Date().toISOString(),
        environment: appConfig.env,
        level: "error",
        channel: "logger",
        message: "Unable to write log file.",
        meta: { error: error.message }
      });
    }
  });
}

function writeToConsole(level, payload) {
  const output = JSON.stringify(payload);

  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

function ensureLogDirectory() {
  fs.mkdirSync(appConfig.logsPath, { recursive: true });
}

function cleanupExpiredLogs() {
  if (!appConfig.logToFile || appConfig.logRetentionDays <= 0) {
    return;
  }

  const retentionMs = appConfig.logRetentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  fs.readdir(appConfig.logsPath, (error, files) => {
    if (error) {
      return;
    }

    files
      .filter((fileName) => fileName.endsWith(".log"))
      .forEach((fileName) => {
        const filePath = path.join(appConfig.logsPath, fileName);

        fs.stat(filePath, (statError, stats) => {
          if (!statError && now - stats.mtimeMs > retentionMs) {
            fs.unlink(filePath, () => {});
          }
        });
      });
  });
}

function getCurrentDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeMeta(meta) {
  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: appConfig.isProduction ? undefined : meta.stack
    };
  }

  if (Array.isArray(meta)) {
    return meta.map((item) => sanitizeMeta(item));
  }

  if (meta && typeof meta === "object") {
    return Object.entries(meta).reduce((safeMeta, [key, value]) => {
      const normalizedKey = key.toLowerCase();
      const isExplicitSafeDiagnostic = normalizedKey === "passwordmatched" || normalizedKey === "haspassword";
      const isSensitive = !isExplicitSafeDiagnostic && SENSITIVE_KEYS.some((sensitiveKey) => normalizedKey.includes(sensitiveKey.toLowerCase()));

      safeMeta[key] = isSensitive ? "[REDACTED]" : sanitizeMeta(value);
      return safeMeta;
    }, {});
  }

  return meta;
}




