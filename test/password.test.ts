import { bcryptPassword, verifyPassword } from '../src/password';

describe('Password', () => {
  // jest.setTimeout(10000); // required for bcrypt.compareSync - which is intentionally slow!

  beforeEach(() => {
    jest.resetModules();
  });

  describe('bcryptPassword()', () => {
    test('encrypt clear text password into bcrypt hash', done => {
      expect(bcryptPassword('password')).toHaveLength(60);
      expect(bcryptPassword('password')).toMatch(/^[a-zA-Z0-9\/\.\$]{60}$/);
      expect(bcryptPassword('password')).toMatch(/^\$2[ayb]\$.{56}$/);
      done();
    });

    test('password hash should be verifyable', done => {
      expect(verifyPassword('password', bcryptPassword('password'))).toBeTruthy();
      done();
    });
  });
});
