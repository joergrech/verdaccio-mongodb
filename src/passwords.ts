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
 * @param {string} password
 * @param {string} hash
 * @returns {boolean}
 */
export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
  // if (hash.match(/^\$2(a|b|y)\$/)) {
  //   return bcrypt.compareSync(password, hash);
  // } else if (hash.indexOf('{PLAIN}') === 0) {
  //   return password === hash.substr(7);
  // } else if (hash.indexOf('{SHA}') === 0) {
  //   return (
  //     crypto
  //       .createHash('sha1')
  //       // https://nodejs.org/api/crypto.html#crypto_hash_update_data_inputencoding
  //       .update(password, 'utf8')
  //       .digest('base64') === hash.substr(5)
  //   );
  // }
  // // for backwards compatibility, first check md5 then check crypt3
  // return md5(password, hash) === hash || crypt3(password, hash) === hash;
}
