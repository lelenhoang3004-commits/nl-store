/**
 * Environment loader.
 * This file centralizes dotenv initialization and exposes normalized environment helpers.
 */
import dotenv from "dotenv";

dotenv.config();

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: !process.env.NODE_ENV || process.env.NODE_ENV === "development",
  port: Number(process.env.PORT || 5000),
  apiPrefix: process.env.API_PREFIX || "/api/v1"
});

export function getEnv(key, fallback = "") {
  return process.env[key] ?? fallback;
}
