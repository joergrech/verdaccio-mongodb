import bcrypt from 'bcryptjs';

/**
 * passwordToBcrypt - encrypts clear text password with bcrypt.
 * @param {string} password
 * @returns {string}
 */
export function bcryptPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  return hash;
}

/**
 * verifyPassword - matches password and it's hash.
 * NOTE: bcrypt.compareSync is intentionally slow!
 * @param {string} password
 * @param {string} hash
 * @returns {boolean}
 */
export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
