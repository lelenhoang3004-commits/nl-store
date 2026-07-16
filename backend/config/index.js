/**
 * Configuration barrel file.
 * Importing config from one place keeps module dependencies clean.
 */
export { appConfig } from "./app.config.js";
export { databaseConfig } from "./database.config.js";
export { databasePool, testDatabaseConnection } from "./database.js";
export { env, getEnv } from "./env.js";
export { jwtConfig } from "./jwt.js";
export { multerConfig } from "./multer.js";
export { AUTH_PERMISSIONS, AUTH_ROLES, ROLE_PERMISSIONS, getPermissionsByRole } from "./auth.config.js";
