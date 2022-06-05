/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { getUnauthorized, getInternalError, getForbidden, getBadData } from '@verdaccio/commons-api';
import LRU from 'lru-cache';
type CachedUser = {
  password: string;
  groups: Array<string>;
}

import { AuthMongoDBConfig } from '../types/index';

import mongoConnector from './mongoConnector.js';
import { intersect } from './helpers';
import { bcryptPassword, verifyPassword } from './password';

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
export default class AuthMongoDB implements IPluginAuth<AuthMongoDBConfig> {
  public logger: Logger;
  private config: AuthMongoDBConfig;
  public cache: LRU<string, unknown>;

  public constructor(config: AuthMongoDBConfig, options: PluginOptions<AuthMongoDBConfig>) {
    this.logger = options.logger;
    this.config = config;

    // TODO: delete this after testing!
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pjson = require('../package.json');
    this.logger.info(`mongodb: Testing version "${pjson.version}"!`);

    // Basic configuration check
    let requiredConfigMissing = false;
    if (!config.uri) {
      this.logger.error('mongodb: Required URI was not specified in the config file!');
      requiredConfigMissing = true;
    }
    if (!config.db) {
      this.logger.error('mongodb: Required DB was not specified in the config file!');
      requiredConfigMissing = true;
    }
    if (!this.config.collections) {
      this.config.collections = {};
    }
    if (!config.collections.users) {
      this.logger.error('mongodb: Required "users" Collection was not specified in the config file!');
      requiredConfigMissing = true;
    }
    if (!config.collections.packages) {
      this.logger.debug('mongodb: The "packages" Collection was not specified in the config file!');
    }
    if (!this.config.fields) {
      this.config.fields = {};
    }
    if (!config.fields?.username) {
      this.logger.warn('mongodb: Field username was not specified in the config file! Using default "username"');
      this.config.fields.username = 'username';
    }
    if (!config.fields?.password) {
      this.logger.warn('mongodb: Field password was not specified in the config file! Using default "password"');
      this.config.fields.password = 'password';
    }
    if (!config.fields?.usergroups) {
      this.logger.warn('mongodb: Field usergroups was not specified in the config file! Using default "usergroups"');
      this.config.fields.usergroups = 'usergroups';
    }
    if (!config.fields?.packagename) {
      this.logger.warn('mongodb: Field packagename was not specified in the config file! Using default "packagename"');
      this.config.fields.packagename = 'packagename';
    }

    if (!this.config.rights) {
      this.config.rights = {};
    }
    if (!config.rights?.access) {
      this.logger.warn('mongodb: Right to access was not specified in the config file! Using default "user"');
      this.config.rights.access = 'user';
    }
    if (!config.rights?.publish) {
      this.logger.warn('mongodb: Right to publish was not specified in the config file! Using default "user"');
      this.config.rights.publish = 'user';
    }
    if (!config.rights?.unpublish) {
      this.logger.warn('mongodb: Right to unpublish was not specified in the config file! Using default "user"');
      this.config.rights.unpublish = 'user';
    }

    if (config.allowAddUser === undefined || (config.allowAddUser !== true && config.allowAddUser !== false)) {
      this.logger.warn(
        'mongodb: Optional field allowAddUser was not specified in the config file! Using default "false"'
      );
      this.config.allowAddUser = false;
    }

    if (!config.countActivity) {
      this.logger.warn(
        'mongodb: Optional field countActivity was not specified in the config file! Using default "false".'
      );
      this.config.countActivity = false;
    }
    if (!config?.adminGroup) {
      this.logger.warn('mongodb: Field adminGroup was not specified in the config file! Using default "__admin__"');
      this.config.adminGroup = '__admin__';
    }
    if (!config.cacheTTL) {
      this.logger.debug(
        'mongodb: Optional field cacheTTL was not specified in the config file! Using default "5 minutes"'
      );
      this.config.cacheTTL = 5 * 60 * 1000;
    }
    cacheOptions.ttl = this.config.cacheTTL;
    this.cache = new LRU(cacheOptions);

    if (requiredConfigMissing) {
      throw new Error('must specify "uri", "db", and "collections.users" in config');
    }

    mongoConnector.setConfig(this.config);
    mongoConnector.setLogger(this.logger);
    return this;
  }

  /**
   * Authenticate an user.
   * @param user user to log
   * @param password provided password
   * @param cb callback function
   */
  public async authenticate(username: string, password: string, cb: AuthCallback): Promise<void> {
    this.logger.debug("mongodb: Authenticate user '" + username + "' with password '" + password + "'");

    if (username) {
      const user: CachedUser = this.cache?.get(username) || {password:'',groups:[]};
      if (verifyPassword(password, user?.password || '')) {
        // Found user with password in cache
        this.logger.debug(`mongodb: Found user '${username}' in cache!`);
        return cb(null, user?.groups); // WARN: empty group [''] evaluates to false (meaning: access denied)!
        // return cb(getCode(200, `Found user '${username}' in cache!`), this.cache.get(username).groups); // WARN: empty group [''] evaluates to false (meaning: access denied)!
      }
    }

    const client = await mongoConnector.connectToDatabase(this.config?.uri);
    const db = await mongoConnector.getDb(this.config?.db);

    try {
      await client.connect();
      const users = await db.collection(this.config?.collections.users);
      const authQuery = `{ "${this.config?.fields?.username}": "${username}" }`;
      const authOptions = `{ "projection": { "_id": 0, "${this.config?.fields?.username}": 1, "${this.config?.fields?.password}": 1, "${this.config?.fields?.usergroups}": 1 } }`;

      const foundUsers = await users.find(JSON.parse(authQuery), JSON.parse(authOptions));
      const firstUser = await foundUsers.next();

      if (
        !firstUser ||
        Object.keys(firstUser).length === 0 ||
        !verifyPassword(password, firstUser[this.config?.fields?.password])
      ) {
        cb(getUnauthorized(`bad username/password, access denied for username '${username}'!`), false);
      } else {
        let groups: string[] = ['user'];
        if (firstUser[this.config?.fields?.usergroups] && firstUser[this.config?.fields?.usergroups] !== undefined) {
          groups = firstUser[this.config?.fields?.usergroups];
        }
        groups.push(firstUser[this.config?.fields?.username]);
        groups = groups.filter((v, i, a) => a.indexOf(v) === i); // unique values if user was already included

        // Add user to cache
        this.cache.set(username, {
          password: firstUser[this.config?.fields?.password],
          groups: groups,
        });

        this.logger.debug(`mongodb: Auth succeded for '${username}' with groups: '${JSON.stringify(groups)}'`);
        cb(null, groups); // WARN: empty group [''] evaluates to false (meaning: access denied)!
        // cb(getCode(200, `Found user '${username}' in database!`), groups); // WARN: empty group [''] evaluates to false (meaning: access denied)!
      }
    } catch (e) {
      this.logger.error(e);
      cb(getInternalError('error, try again: ' + e), false);
    }
  }

  /**
   * Change a user password
   * @param username username to create
   * @param password current/old password
   * @param newPassword new password
   * @param cb callback function
   */
  public changePassword(username: string, password: string, newPassword: string, cb: Callback): Promise<void> {
    this.logger.warn(`mongodb: changePassword called for user: ${username}`);
    return cb(getInternalError('You are not allowed to change the password via the CLI!'), false);
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

    const client = await mongoConnector.connectToDatabase(this.config?.uri);
    const db = await mongoConnector.getDb(this.config?.db);

    try {
      await client.connect();
      const users = await db.collection(this.config?.collections.users);

      if (this.config.allowAddUser) {
        // Trying to insert user - will throw exception if duplicate username already exists
        const insertQuery = `{ "${this.config?.fields?.username}": "${username}", "${
          this.config?.fields?.password
        }": "${bcryptPassword(password)}", "usergroups": ["${username}","user"] }`;
        const newUser = await users.insertOne(JSON.parse(insertQuery));
        this.logger.info(`mongodb: Added new user: ${JSON.stringify(newUser)}`);
        cb(null, true);
      } else {
        this.logger.warn(`mongodb: Adding new user was disabled! You are not allowed to add users via the CLI!`);
        cb(null, true); // Signalling OK even if user was NOT added (or login is not possible anymore)
        // cb(getInternalError('You are not allowed to add users via the CLI!'), false);
      }
    } catch (e) {
      const error: string = (e as Error).message;
      if (error.includes('duplicate key error')) {
        cb(null, true); // Signalling OK even if user already exists
        // cb(getForbidden(`Bad username, user '${username}' already exists!`), true);
      } else {
        cb(getInternalError('Error with adding user to MongoDB: ' + JSON.stringify(e)), false);
      }
    }
  }

  /**
   * Check if user is allowed to access a package
   * Triggered on each access request
   * @param user
   * @param pkg
   * @param cb
   */
  public async allow_access(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): Promise<void> {
    const groupsIntersection = intersect(user.groups, pkg?.access || []);
    let hasRights = false;
    if (this.config.rights?.access === 'maintainer') {
      hasRights = user.groups.includes((pkg as any).name);
    } else if (this.config.rights?.access === 'contributor') {
      hasRights = user.groups.includes((pkg as any).name);
    } else {
      hasRights = pkg?.access?.includes(user.name || '') || groupsIntersection.length > 0;
    }
    if (hasRights || user.groups.includes(this.config.adminGroup)) {
      await mongoConnector.incCounter('access', user.name, (pkg as any).name, this.config);
      this.logger.info(`mongodb: ${user.name} has been granted access to package '${(pkg as any).name}'`);
      cb(null, true);
    } else {
      this.logger.error(
        `mongodb: ${user.name || 'anonymous user'} is not allowed to access the package '${
          (pkg as any).name
        }' - config rights set were to '${this.config.rights?.access}`
      );
      cb(
        getForbidden(
          `User ${user.name} is not allowed to access the package ${(pkg as any).name} - only ${
            this.config.rights?.access
          }s are!`
        ),
        false
      );
    }
  }

  /**
   * Check if user is allowed to publish a package
   * Triggered on each publish request
   * @param user
   * @param pkg
   * @param cb
   */
  public async allow_publish(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): Promise<void> {
    const groupsIntersection = intersect(user.groups, pkg?.publish || []);
    let hasRights = false;
    if (this.config.rights?.publish === 'maintainer') {
      hasRights = user.groups.includes((pkg as any).name);
    } else if (this.config.rights?.publish === 'contributor') {
      hasRights = user.groups.includes((pkg as any).name);
    } else {
      hasRights = pkg?.publish?.includes(user.name || '') || groupsIntersection.length > 0;
    }
    if (hasRights || user.groups.includes(this.config.adminGroup)) {
      await mongoConnector.incCounter('publish', user.name, (pkg as any).name, this.config);
      this.logger.info(
        `mongodb: ${user.name} has been granted the right to publish the package '${
          (pkg as any).name
        }' - config rights set were to '${this.config.rights?.publish}'`
      );
      cb(null, true);
    } else {
      this.logger.error(
        `mongodb: ${user.name} is not allowed to publish the package '${
          (pkg as any).name
        }' - config rights set were to '${this.config.rights?.publish}`
      );
      cb(
        getForbidden(
          `User ${user.name} is not allowed to publish the package ${(pkg as any).name} - only ${
            this.config.rights?.publish
          }s are!`
        ),
        false
      );
    }
  }

  /**
   * Check if user is allowed to remove a package
   * Triggered on each unpublish request
   * @param user
   * @param pkg
   * @param cb
   */
  public async allow_unpublish(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): Promise<void> {
    const groupsIntersection = intersect(user.groups, pkg?.publish || []);
    let hasRights = false;
    if (this.config.rights?.unpublish === 'maintainer') {
      hasRights = user.groups.includes((pkg as any).name);
    } else if (this.config.rights?.unpublish === 'contributor') {
      hasRights = user.groups.includes((pkg as any).name);
    } else {
      hasRights = pkg?.publish?.includes(user.name || '') || groupsIntersection.length > 0;
    }
    if (hasRights || user.groups.includes(this.config.adminGroup)) {
      await mongoConnector.incCounter('unpublish', user.name, (pkg as any).name, this.config);
      this.logger.info(
        `mongodb: ${user.name} has been granted the right to unpublish the package '${
          (pkg as any).name
        }' - config rights set were to '${this.config.rights?.unpublish}`
      );
      cb(null, true);
    } else {
      this.logger.error(
        `mongodb: ${user.name} is not allowed to unpublish the package '${
          (pkg as any).name
        }' - config rights set were to '${this.config.rights?.unpublish}`
      );
      cb(
        getForbidden(
          `User ${user.name} is not allowed to unpublish the package ${(pkg as any).name} - only ${
            this.config.rights?.unpublish
          }s are!`
        ),
        false
      );
    }
  }
}
