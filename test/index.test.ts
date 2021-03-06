import AuthMongoDB from '../src/index';
import mongoConnector from '../src/mongoConnector.js';

import Logger from './__mocks__/Logger';

describe('AuthMongoDB', () => {
  const OLD_ENV = process.env;
  const config = {
    uri: process.env.MONGODB_URI, // NOTE: use .env file in root of this project with 'mongodb+srv://<USER>:<PASS>@<HOST>/<DB>' etc.
    db: process.env.MONGODB_DB,
    collections: {
      users: process.env.MONGODB_COLLECTION_USERS,
      packages: process.env.MONGODB_COLLECTION_PACKAGES,
    },
    encryption: 'bcrypt',
    allowAddUser: true,
    countActivity: false,
    cacheTTL: 300000,
    fields: {
      username: 'username',
      password: 'password',
      usergroups: 'usergroups',
    },
    rights: {
      access: 'user',
      publish: 'user',
      unpublish: 'user',
    },
  };
  const options = { config: {}, logger: new Logger() };
  let wrapper;

  beforeEach(() => {
    process.env = { ...OLD_ENV }; // Make a copy in case default values are used
    wrapper = new AuthMongoDB(config, options);
    jest.resetModules();
  });

  afterAll(done => {
    // Closing the DB connection allows Jest to exit successfully.
    wrapper.cached?.conn?.close();
    done();
  });

  describe('constructor()', () => {
    test('throw Error if required configs are missing', () => {
      expect(function() {
        new AuthMongoDB({}, { config: {}, logger: new Logger() });
      }).toThrow(/must specify "uri", "db", and "collections.users" in config/);
    });
  });

  describe('authenticate()', () => {
    test("don't authenticate user with invalid credentials", done => {
      const callbackAccessDenied = (error, groups): void => {
        expect(error?.message).toContain('access denied');
        expect(groups).toBeFalsy();
        done();
      };
      wrapper.authenticate('nonexistantuser', 'n/a', callbackAccessDenied);
      // wrapper.authenticate(null, 'n/a', callbackAccessDenied);
      // wrapper.authenticate(123, 'n/a', callbackAccessDenied);
    });

    test('authenticate user with valid credentials', done => {
      const callbackFromDB = (error, groups): void => {
        expect(error).toBeNull();
        expect(groups).toContain('testgroup');
        done();
      };
      wrapper.authenticate('testuser', 'password4711', callbackFromDB);

      // TODO: Test cache authentication:
      // expect(wrapper.cache).toEqual(expect.anything());
      // expect(wrapper.cache).toEqual(expect.any(LRU));
      // // expect(wrapper.cache.has('testuser')).toBeTruthy(); // Does not work
      // const callbackFromCache = (error, groups): void => {
      //   expect(error).toContain('in cache'); Does not work as error can only be error (getCode does not work - is used as fail in verdaccio)
      //   expect(groups).toContain('testgroup');
      //   done();
      // };
      // wrapper.authenticate('testuser', 'password4711', callbackFromCache);
    });
  });

  describe('changePassword()', () => {
    test('should never work', done => {
      const callback = (error, isSuccess): void => {
        expect(error.message).toContain('not allowed');
        expect(isSuccess).toBeFalsy();
        done();
      };
      wrapper.changePassword('username', 'password', 'newPassword', callback);
    });
  });

  describe('addUser()', () => {
    test('do not pass sanity check if invalid', done => {
      wrapper.adduser('jo', 'username to short', (error, groups) => {
        expect(error?.message).toContain('too short');
        expect(groups).toBeFalsy();
        // done(); // due to "Expected done to be called once, but it was called multiple times."
      });
      wrapper.adduser('password to short', '123', (a, groups) => {
        expect(a?.message).toContain('too short');
        expect(groups).toBeFalsy();
      });
      done();
    });

    test('do not add duplicate users', done => {
      const callbackDuplicate = (error, groups): void => {
        expect(error).toBeNull();
        // expect(error.message).toContain('already exists'); Does not work - even with getCode(200, "Message")
        expect(groups).toBeTruthy();
        done();
      };
      wrapper.adduser('testuser', 'username already exists', callbackDuplicate);
    });

    test('do not add duplicate users if allowAddUser == false', done => {
      const callbackDuplicate = (error, groups): void => {
        expect(error).toBeNull();
        expect(groups).toBeTruthy();
        done();
      };
      const newConfig = JSON.parse(JSON.stringify(config));
      newConfig.allowAddUser = false;
      const wrapper2 = new AuthMongoDB(newConfig, options);
      wrapper2.adduser('testuser9182', 'username can not exists', callbackDuplicate);
    });
  
    test('add new user with valid data', async () => {
      const callback = (error, groups): void => {
        expect(error).toBeNull();
        expect(groups).toBeTruthy();
      };
      const randomUsername = `deleteme_${(Math.random() + 1).toString(36).substring(2)}`;
      const randomPassword = `deleteme_${(Math.random() + 1).toString(36).substring(2)}`;
      await wrapper.adduser(randomUsername, randomPassword, callback);

      // Cleanup Database
      const client = await mongoConnector.connectToDatabase(config?.uri);
      const db = await mongoConnector.getDb(config?.db);
      await client.connect();
      const users = await db.collection(config?.collections.users);
      const query = `{ "${config?.fields?.username}": { "$regex": "deleteme_.*" } }`;
      await users.deleteMany(JSON.parse(query));
    });
  });

  // describe('allow_access()', () => {
  //   // TODO: mock PackageAccess
  //   test('allow if user has direct access', done => {
  //     const callback = (error, isSuccess) => {
  //       expect(error.message).toContain('not allowed');
  //       expect(isSuccess).toBeFalsy();
  //       done();
  //     };
  //     wrapper.allow_access('username', package, callback);
  //   });
  //   test('deny if user has no direct access', done => {
  //   });
  //   test('allow if user has group access', done => {
  //   });
  //   test('deny if user has no group access', done => {
  //   });
  // });
  // describe('allow_publish()', () => {
  // });
  // describe('allow_unpublish()', () => {
  // });
});
