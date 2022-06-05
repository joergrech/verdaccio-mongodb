# verdaccio-mongodb

> The MongoDB Authentication plugin for Verdaccio

This plugin enables you to use a MongoDB or compatible database (e.g., AWS DocumentDB - currently, compatible to MongoDB 3.6 and 4.0) as the store for your user data. 
This is especially useful if you want to use an existing user database, if you have other registries beside npm/verdaccio with the same users, if you want to store additional information with the users, or if you want to create users from an external system.

> *NOTE: This plugin includes a basic counting mechanism for activities which might be used as a "weekly download" indicator (currently this data is only available in the MongoDB)*

## Installation

### Install MongoDB auth plugin into Verdaccio

Add the MongoDB auth plugin to your Verdaccio installation like this:

```shell
npm install -g verdaccio-mongodb
```

### Setup Database

1. Create a MongoDB (or DocumentDB, etc.)
2. Create "admin" user with correct roles, rights, and password
3. Secure database with password, auth keys or secure VPN
4. Create or identify collections
   * Create or identify a collection for the users (must include a field for unique username/email, password (currently, only bcrypt), and usergroups)
   * Optional: Create a collection for the packages (will store counts for activities such as access, publish and unpublish)
5. Create indices as needed
   * The "users" collection could use a index on the field holding the "username"
   * The "packages" collection could use a index on the field holding the "packagename"

## Configure Verdaccio to use MongoDB auth

Change the `auth` section in your `config.yaml` file to include the following. Replace the existing `auth` section or add it to an existing `auth` chain - but first replace placeholders with your specific values.

```yaml
auth:
  mongodb:
    uri: "mongodb+srv://[username]:[password]@[host1][:port1]/[db]"
    db: "verdaccio"
    collections:
      users: "users"
      packages: "packages"
    encryption: "bcrypt"
    allowAddUser: true
    countActivity: true
    cacheTTL: 300000
    adminGroup: "&admin"
    fields:
      username:   "username"
      password:   "password"
      usergroups: "usergroups"
      packagename: "packagename"
    rights:
      access:     "user"
      publish:    "maintainer"
      unpublish:  "maintainer"
```

Configuration options
* `uri`: The MongoDB-like URI including admin username, password and database holding the user collection. **[REQUIRED]**
* `database`: The database in the MongoDB holding the user collection **[REQUIRED]**
* `collections`: (name of the collections in the mongodb database)
  * `users`: Name of the user collection used to store the unique user with passwords and additional information (e.g., username, email, access, etc.). Defaults to `users` **[REQUIRED]**
  * `packages`: Name of the packages collection used to store information on the packages (e.g., name, access, versions, etc.). Defaults to `packages` **[OPTIONAL]**
* `encryption`: The mechanism to encrypt the password (currently supported: `none`, `bcrypt`). Defaults to `bcrypt` **[OPTIONAL]**
* `allowAddUser`: Switch to allow or disallow adding users. Defaults to `false` **[OPTIONAL]**
* `countActivity`: Switch to enable or disable counting access, publish, or unpublish events. Defaults to `false` **[OPTIONAL]**
* `cacheTTL`: Time an entry lives in the cache measured in ms. Defaults to `300000` (5 minutes) **[OPTIONAL]**
* `adminGroup`: The name of the group of admins allowed to access, publish, or unpublish any package. Must be different from user or package names! Defaults to `__admin__` **[OPTIONAL]**
* `fields`: (name of the fields in the mongodb collection)
  * `username`: Name of the field used to store the unique username (e.g., user, username, email, etc.). Defaults to `username` **[OPTIONAL]**
  * `password`: Name of the field used to store the password (e.g., pass, password, token, etc.). Defaults to `password` **[OPTIONAL]**
  * `usergroups`: Name of the field used to store the array of usergroups (e.g., groups, usergroups, roles, etc.). Defaults to `usergroups` **[OPTIONAL]**
* `rights`: (Definition of who is allowed to work with packages)
  * `access`: Name of people allowed to access a package (currently supported: `maintainer`, `contributor`, `user`). Defaults to `user` (if authenticated or anonymous user depends on 'packages' config) **[OPTIONAL]**
  * `publish`: Name of people allowed to publish a package (currently supported: `maintainer`, `contributor`, `user`). Defaults to `user` (if authenticated or anonymous user depends on 'packages' config) **[OPTIONAL]**
  * `unpublish`: Name of people allowed to unpublish a package (currently supported: `maintainer`, `contributor`, `user`). Defaults to `user` (if authenticated or anonymous user depends on 'packages' config) **[OPTIONAL]**

## NOTES
An alternative verdaccio auth plugin exists called `verdaccio-auth-mongo`: see https://www.npmjs.com/package/verdaccio-auth-mongo and https://gitlab.com/stack-library-open/verdaccio-auth-mongo/-/blob/master/index.js
