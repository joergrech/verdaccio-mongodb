import {
  PluginOptions,
  AuthAccessCallback,
  AuthCallback,
  Callback,
  PackageAccess,
  IPluginAuth,
  RemoteUser,
  Logger,
} from '@verdaccio/types';
import { getUnauthorized, getInternalError, getForbidden, getBadData, getCode } from '@verdaccio/commons-api';
import LRU from 'lru-cache';
import LRUCache from 'lru-cache';

import { CustomConfig } from '../types/index';
import mongoConnector from '../util/mongoConnector.js';

import { intersect } from './helpers';
import { bcryptPassword, verifyPassword } from './passwords';

const cacheOptions = {
  max: 1000,
  ttl: 1000 * 60 * 5,
  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
};

/**
 * Custom Verdaccio Authenticate Plugin.
 */
export default class MongoDBPluginAuth implements IPluginAuth<CustomConfig> {
  public logger: Logger;
  private config: CustomConfig;
  private cache: LRUCache<string, any>;

  public constructor(config: CustomConfig, options: PluginOptions<CustomConfig>) {
    this.logger = options.logger;
    this.config = config;

    // Basic configuration check
    if (!config.uri) {
      this.logger.error('auth-mongodb: URI was not specified in the config file!');
    }
    if (!config.db) {
      this.logger.error('auth-mongodb: DB was not specified in the config file!');
    }
    if (!config.collection) {
      this.logger.error('auth-mongodb: Collection was not specified in the config file!');
    }
    if (!config.fields.username) {
      this.logger.warn(
        'auth-mongodb: Field name for username was not specified in the config file! Using default "username"'
      );
      this.config.fields.username = 'username';
    }
    if (!config.fields.password) {
      this.logger.warn(
        'auth-mongodb: Field name for password was not specified in the config file! Using default "password"'
      );
      this.config.fields.password = 'password';
    }
    if (!config.fields.usergroups) {
      this.logger.warn(
        'auth-mongodb: Field name for usergroups was not specified in the config file! Using default "usergroups"'
      );
      this.config.fields.usergroups = 'usergroups';
    }
    if (config.userIsUnique === undefined || (config.userIsUnique !== true && config.userIsUnique !== false)) {
      this.logger.warn(
        'auth-mongodb: Config for userIsUnique was not specified in the config file! Using default "true"'
      );
      this.config.fields.userIsUnique = true;
    }

    if (!config.cacheTTL) {
      this.logger.warn(
        'auth-mongodb: Config for cacheTTL was not specified in the config file! Using default "5 minutes"'
      );
      this.config.cacheTTL = 5 * 60 * 1000;
    }
    cacheOptions.ttl = this.config.cacheTTL;
    this.cache = new LRU(cacheOptions);

    return this;
  }

  /**
   * Authenticate an user.
   * @param user user to log
   * @param password provided password
   * @param cb callback function
   */
  public async authenticate(username: string, password: string, cb: AuthCallback): Promise<void> {
    this.logger.debug("auth-mongodb: Authenticate user '" + username + "' with password '" + password + "'");

    // this.logger.info(bcryptPassword(password)); 

    if (verifyPassword(password, this.cache.get(username)?.password || '')) {
      // Found user with password in cache
      this.logger.debug(`auth-mongodb: Found user '${username}' in cache!`);
      return cb(null, this.cache.get(username).groups); // WARN: empty group [''] evaluates to false (meaning: access denied)!
    }

    const client = await mongoConnector.connectToDatabase(this.config.uri);
    const db = await mongoConnector.getDb(this.config.db);

    try {
      await client.connect();
      const users = (await db).collection(this.config.collection);
      const authQuery = `{ "${this.config.fields.username}": "${username}" }`;
      const authOptions = `{ "projection": { "_id": 0, "${this.config.fields.username}": 1, "${this.config.fields.password}": 1, "${this.config.fields.usergroups}": 1 } }`;

      const foundUsers = await users.find(JSON.parse(authQuery), JSON.parse(authOptions));
      const firstUser = await foundUsers.next();

      if (
        !firstUser ||
        Object.keys(firstUser).length === 0 ||
        !verifyPassword(password, firstUser[this.config.fields.password])
      ) {
        cb(getUnauthorized(`bad username/password, access denied for username '${username}'!`), false);
      } else {
        let groups: string[] = ['user'];
        if (firstUser[this.config.fields.usergroups] && firstUser[this.config.fields.usergroups] !== undefined) {
          groups = firstUser[this.config.fields.usergroups];
        }

        // TODO:
        // Add test cases (add user, auth, publish, unpublish, remove user?, ...): https://jestjs.io/

        // Add user to cache
        this.cache.set(username, {
          password: firstUser[this.config.fields.password],
          groups: groups,
        });

        this.logger.debug(`auth-mongodb: Auth succeded for '${username}' with groups: '${JSON.stringify(groups)}'`);
        return cb(null, groups); // WARN: empty group [''] evaluates to false (meaning: access denied)!
      }
    } catch (e) {
      this.logger.error(e);
      cb(getInternalError('error, try again: ' + e), false);
    } finally {
      await client.close();
    }
  }

  /**
   * Change a user password
   * @param username username to create
   * @param password current/old password
   * @param newPassword new password
   * @param cb callback function
   */
  public changePassword(username: string, password: string, newPassword: string, cb: Callback) {
    this.logger.warn(`auth-mongodb: changePassword called for user: ${username}`);
    return cb(
      getInternalError('You are not allowed to change the password here! Please change your password via the webapp!')
    );
  }

  /**
   * Add a user to the database
   * @param username username to create
   * @param password provided password
   * @param cb callback function
   */
  public async adduser(username: string, password: string, cb: Callback): Promise<void> {
    if (!username || username.length < 3) {
      return cb(getBadData(`Bad username, username is too short (min 3 characters)!`), false);
    }

    if (!password || password.length < 8) {
      return cb(getBadData(`Bad password, password is too short (min 8 characters)!`), false);
    }

    const client = await mongoConnector.connectToDatabase(this.config.uri);
    const db = await mongoConnector.getDb(this.config.db);

    try {
      await client.connect();
      const users = (await db).collection(this.config.collection);
      const lookupQuery = `{ "${this.config.fields.username}": "${username}" }`;
      const lookupOptions = `{ "projection": { "_id": 0, "${this.config.fields.username}": 1, "${this.config.fields.usergroups}": 1 } }`;

      if (!this.config.userIsUnique || this.config.userIsUnique == undefined) {
        // Check if user already exist - not necessary with uniqueIndex
        const foundUsers = await users.find(JSON.parse(lookupQuery), JSON.parse(lookupOptions));
        const firstUser = await foundUsers.next();
        if (firstUser) {
          return cb(null, true);
          // return cb(getForbidden(`Bad username, user '${username}' already exists!`), false);
        }
      }

      // Trying to insert user - will throw exception if duplicate username already exists
      const insertQuery = `{ "${this.config.fields.username}": "${username}", "${this.config.fields.password}": "${password}", "usergroups": ["user"] }`;
      const newUser = await users.insertOne(JSON.parse(insertQuery));
      this.logger.info(`auth-mongodb: Added new user: ${JSON.stringify(newUser)}`);
      cb(null, true);
    } catch (e) {
      const error = e.toString();
      if (error.includes('duplicate key error')) {
        cb(null, true);
        // cb(getForbidden(`Bad username, user '${username}' already exists!`), false);
      } else {
        cb(getInternalError('Error with adding user to MongoDB: ' + typeof e), false);
      }
    } finally {
      await client.close();
    }
  }

  /**
   * Check if user is allowed to access a package
   * Triggered on each access request
   * @param user
   * @param pkg
   * @param cb
   */
  public allow_access(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): void {
    const groupsIntersection = intersect(user.groups, pkg?.access || []);
    if (pkg?.access?.includes[user.name || ''] || groupsIntersection.length > 0) {
      this.logger.debug(`auth-mongodb: ${user.name} has been granted access to package '${(pkg as any).name}'`);
      cb(null, true);
    } else {
      this.logger.error(`auth-mongodb: ${user.name} is not allowed to access the package '${(pkg as any).name}'`);
      cb(getForbidden('error, try again'), false);
    }
  }

  /**
   * Check if user is allowed to publish a package
   * Triggered on each publish request
   * @param user
   * @param pkg
   * @param cb
   */
  public allow_publish(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): void {
    const groupsIntersection = intersect(user.groups, pkg?.publish || []);
    if (pkg?.publish?.includes[user.name || ''] || groupsIntersection.length > 0) {
      this.logger.debug(
        `auth-mongodb: ${user.name} has been granted the right to publish the package '${(pkg as any).name}'`
      );
      cb(null, true);
    } else {
      this.logger.error(`auth-mongodb: ${user.name} is not allowed to publish the package '${(pkg as any).name}'`);
      cb(getForbidden('error, try again'), false);
    }
  }

  /**
   * Check if user is allowed to remove a package
   * Triggered on each unpublish request
   * @param user
   * @param pkg
   * @param cb
   */
  public allow_unpublish(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): void {
    const groupsIntersection = intersect(user.groups, pkg?.publish || []);
    if (pkg?.publish?.includes[user.name || ''] || groupsIntersection.length > 0) {
      this.logger.debug(
        `auth-mongodb: ${user.name} has been granted the right to unpublish the package '${(pkg as any).name}'`
      );
      cb(null, true);
    } else {
      this.logger.error(`auth-mongodb: ${user.name} is not allowed to unpublish the package '${(pkg as any).name}'`);
      cb(getForbidden('error, try again'), false);
    }
  }
}
