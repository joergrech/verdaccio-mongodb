# verdaccio-mongodb

> The MongoDB Authentication plugin for Verdaccio

This plugin enables you to use a MongoDB or compatible database (e.g., AWS DocumentDB - currently, compatible to MongoDB 3.6 and 4.0) as the store for your user data. 
This is especially useful if you want to use an existing user database, if you have other registries beside npm/verdaccio with the same users, if you want to store additional information with the users, or if you want to create users from an external system.

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
4. Create indices as needed

## Configure Verdaccio to use MongoDB auth

Change the `auth` section in your `config.yaml` file to include the following. Replace the existing `auth` section or add it to an existing `auth` chain - but first replace placeholders with your specific values.

```yaml
auth:
  mongodb:
    uri: "mongodb+srv://[username]:[password]@[host1][:port1]/[db]"
    db: "verdaccio"
    collection: "users"
    encryption: "bcrypt"
    userIsUnique: true
    allowAddUser: true
    cacheTTL: 300000
    fields:
      username:   "username"
      password:   "password"
      usergroups: "usergroups"
    rights:
      access:     "user"
      publish:    "maintainer"
      unpublish:  "maintainer"
```

Configuration options
* `uri`: The MongoDB-like URI including admin username, password and database holding the user collection. [REQUIRED]
* `database`: The database in the MongoDB holding the user collection [REQUIRED]
* `username`: The clear-text name of the admin user who has the necessary roles or rights to insert, update, delete(?), and lookup users in a specific collection (i.e., [user-collection]). [REQUIRED]
* `encryption`: The mechanism to encrypt the password (currently supported: `none`, `bcrypt`). Defaults to `bcrypt` [OPTIONAL]
* `userIsUnique`: Switch to check unique user (currently supported: `true`, `false`). Defaults to `true` [OPTIONAL]
* `allowAddUser`: Switch to allow or disallow adding users. Defaults to `false` [OPTIONAL]
* `cacheTTL`: Time an entry lives in the cache measured in ms. Defaults to `300000` (5 minutes) [OPTIONAL]
* `fields`: (name of the fields in the mongodb collection)
  * `username`: Name of the field used to store the unique username (e.g., user, username, email, etc.). Defaults to `username` [OPTIONAL]
  * `password`: Name of the field used to store the password (e.g., pass, password, token, etc.). Defaults to `password` [OPTIONAL]
  * `usergroups`: Name of the field used to store the array of usergroups (e.g., groups, usergroups, roles, etc.). Defaults to `usergroups` [OPTIONAL]
* `rights`: (Definition of who is allowed to work with packages)
  * `access`: Name of people allowed to access a package (currently supported: `maintainer`, `contributor`, `user`). Defaults to `user` (if authenticated or anonymous user depends on 'packages' config) [OPTIONAL]
  * `publish`: Name of people allowed to publish a package (currently supported: `maintainer`, `contributor`, `user`). Defaults to `user` (if authenticated or anonymous user depends on 'packages' config) [OPTIONAL]
  * `unpublish`: Name of people allowed to unpublish a package (currently supported: `maintainer`, `contributor`, `user`). Defaults to `user` (if authenticated or anonymous user depends on 'packages' config) [OPTIONAL]

## NOTES
An alternative verdaccio auth plugin exists called `verdaccio-auth-mongo`: see https://www.npmjs.com/package/verdaccio-auth-mongo and https://gitlab.com/stack-library-open/verdaccio-auth-mongo/-/blob/master/index.js