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
import { getUnauthorized } from '@verdaccio/commons-api';

import { CustomConfig } from '../types/index';
import mongoConnector from '../util/mongoConnector.js';

import { intersection } from './helpers';

/**
 * Custom Verdaccio Authenticate Plugin.
 */
export default class MongoDBPluginAuth implements IPluginAuth<CustomConfig> {
  public logger: Logger;
  private config: CustomConfig;
  private options: PluginOptions<CustomConfig>;

  public constructor(config: CustomConfig, options: PluginOptions<CustomConfig>) {
    this.logger = options.logger;
    this.options = options;
    this.config = config;

    // Basic configuration check
    if (!config.uri) {
      this.logger.error('MongoDB URI was not specified in the config file!');
    }
    if (!config.db) {
      this.logger.error('MongoDB DB was not specified in the config file!');
    }
    if (!config.collection) {
      this.logger.error('MongoDB collection was not specified in the config file!');
    }
    if (!config.fields.username) {
      this.logger.warn(
        'MongoDB field name for username was not specified in the config file! Using default "username"'
      );
      this.config.fields.username = 'username';
    }
    if (!config.fields.password) {
      this.logger.warn(
        'MongoDB field name for password was not specified in the config file! Using default "password"'
      );
      this.config.fields.password = 'password';
    }
    if (!config.fields.usergroups) {
      this.logger.warn(
        'MongoDB field name for usergroups was not specified in the config file! Using default "usergroups"'
      );
      this.config.fields.usergroups = 'usergroups';
    }

    return this;
  }

  /**
   * Authenticate an user.
   * @param user user to log
   * @param password provided password
   * @param cb callback function
   */
  public async authenticate(username: string, password: string, cb: AuthCallback): Promise<void> {
    this.logger.debug("authenticate user '" + username + "' with password '" + password + "'");

    const client = await mongoConnector.connectToDatabase(this.config.uri);
    const db = await mongoConnector.getDb(this.config.db);

    try {
      await client.connect();
      const users = (await db).collection(this.config.collection);
      const authQuery = `{ "${this.config.fields.username}": "${username}", "${this.config.fields.password}": "${password}" }`;
      const authOptions = `{ "projection": { "_id": 0, "${this.config.fields.username}": 1, "${this.config.fields.usergroups}": 1 } }`;

      const foundUsers = await users.find(JSON.parse(authQuery), JSON.parse(authOptions));
      const firstUser = await foundUsers.next();

      if (!firstUser || Object.keys(firstUser).length === 0) {
        this.logger.error(`bad username/password, access denied for username '${username}'!`);
        cb(getUnauthorized(`bad username/password, access denied for username '${username}'!`), false);
      } else {
        let groups: string[] = ['user'];
        if (firstUser[this.config.fields.usergroups] && firstUser[this.config.fields.usergroups] !== undefined) {
          groups = firstUser[this.config.fields.usergroups];
        }

        // TODO:
        // cb(getUnauthorized('the user does not have enough privileges'), false);
        // const err: any = createError(403, `user ${userName} is not allowed to ${action} package ${pkg.name}`);
        // err.code = 403;
        // callback(err, false);
        //
        // bcrypt passwort
        //
        // Add test cases (add user, auth, publish, unpublish, remove user?, ...): https://jestjs.io/
        //
        // changePassword()

        this.logger.info(`MongoDB: Auth succeded for '${username}' with groups: '${JSON.stringify(groups)}'`);
        return cb(null, groups); // WARN: empty group [''] evaluates to false (meaning: access denied)!
      }
    } catch (e) {
      this.logger.error(e);
      cb(getUnauthorized('error, try again: ' + e), false);
    } finally {
      await client.close();
    }
  }

  /**
   * NOTE: Not implemented but available functions (see https://verdaccio.org/docs/plugin-auth)
   *
   * changePassword?(user: string, password: string, newPassword: string, cb: AuthCallback): void;
   */

  /**
   * Add a user to the database
   * @param username username to create
   * @param password provided password
   * @param cb callback function
   */
  public async adduser(username: string, password: string, cb: Callback): Promise<void> {
    if (!username || username.length < 3) {
      this.logger.error(`bad username, username is too short (min 3 characters)!`);
      return cb(getUnauthorized(`bad username, username is too short (min 3 characters)!`), false);
    }

    if (!password || password.length < 8) {
      this.logger.error(`bad password, password is too short (min 8 characters)!`);
      return cb(getUnauthorized(`bad password, password is too short (min 8 characters)!`), false);
    }

    const client = await mongoConnector.connectToDatabase(this.config.uri);
    const db = await mongoConnector.getDb(this.config.db);

    try {
      await client.connect();
      const users = (await db).collection(this.config.collection);
      const lookupQuery = `{ "${this.config.fields.username}": "${username}" }`;
      const lookupOptions = `{ "projection": { "_id": 0, "${this.config.fields.username}": 1, "${this.config.fields.usergroups}": 1 } }`;

      const foundUsers = await users.find(JSON.parse(lookupQuery), JSON.parse(lookupOptions));
      const firstUser = await foundUsers.next();

      if (firstUser) {
        this.logger.error(`bad username, user '${username}' already exists!`);
        return cb(getUnauthorized(`bad username, user '${username}' already exists!`), false);
      }

      const insertQuery = `{ "${this.config.fields.username}": "${username}", "${this.config.fields.password}": "${password}", "usergroups": ["user"] }`;
      const newUser = await users.insert(JSON.parse(insertQuery));
      this.logger.debug(`added new user: ${JSON.stringify(newUser)}`);

      cb(null, true);
    } catch (e) {
      this.logger.error(e);
      cb(getUnauthorized('error, try again: ' + e), false);
    } finally {
      await client.close();
    }
  }

  /**
   * Triggered on each access request
   * @param user
   * @param pkg
   * @param cb
   */
  public allow_access(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): void {
    const groupsIntersection = intersection(user.groups, pkg?.access || []);
    if (pkg?.access?.includes[user.name || ''] || groupsIntersection.length > 0) {
      this.logger.info(`${user.name} has been granted access to package '${(pkg as any).name}'`);
      cb(null, true);
    } else {
      this.logger.error(`${user.name} is not allowed to access the package '${(pkg as any).name}'`);
      cb(getUnauthorized('error, try again'), false);
    }
  }

  /**
   * Triggered on each publish request
   * @param user
   * @param pkg
   * @param cb
   */
  public allow_publish(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): void {
    const groupsIntersection = intersection(user.groups, pkg?.publish || []);
    if (pkg?.publish?.includes[user.name || ''] || groupsIntersection.length > 0) {
      this.logger.info(`${user.name} has been granted the right to publish the package '${(pkg as any).name}'`);
      cb(null, true);
    } else {
      this.logger.error(`${user.name} is not allowed to publish the package '${(pkg as any).name}'`);
      cb(getUnauthorized('error, try again'), false);
    }
  }

  /**
   * Triggered on each unpublish request
   * @param user
   * @param pkg
   * @param cb
   */
  public allow_unpublish(user: RemoteUser, pkg: PackageAccess, cb: AuthAccessCallback): void {
    const groupsIntersection = intersection(user.groups, pkg?.publish || []);
    if (pkg?.publish?.includes[user.name || ''] || groupsIntersection.length > 0) {
      this.logger.info(`${user.name} has been granted the right to unpublish the package '${(pkg as any).name}'`);
      cb(null, true);
    } else {
      this.logger.error(`${user.name} is not allowed to unpublish the package '${(pkg as any).name}'`);
      cb(getUnauthorized('error, try again'), false);
    }
  }
}
