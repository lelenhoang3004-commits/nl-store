/**
 * Password utility.
 * It wraps bcrypt so password hashing decisions stay outside controllers and repositories.
 */
import bcrypt from "bcrypt";

const PASSWORD_SALT_ROUNDS = 12;

export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, PASSWORD_SALT_ROUNDS);
}

export function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
