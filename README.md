# verdaccio-auth-mongodb

> WARN: Work in progress

> The MongoDB Authentication plugin for Verdaccio

This plugin enables you to use a MongoDB or compatible database (e.g., AWS DocumentDB - currently, compatible to MongoDB 3.6 and 4.0) as the store for your user data. 
This is especially useful if you want to use an existing user database, if you want to store additional information with the users, or if you want to create users from an external system.

## Installation

### Install MongoDB auth plugin into Verdaccio

Add the MongoDB auth plugin to your Verdaccio installation like this:

```shell
npm install -g verdaccio-auth-mongodb
```

### Setup Database

1. Create a MongoDB (or DocumentDB, etc.)
2. Secure database with password, auth keys or secure VPN
3. Create user with correct roles, rights, and password
4. ...
5. Create indices as needed

## Configure Verdaccio to use MongoDB auth

Change the `auth` section in your `config.yaml` file to include the following. Replace the existing `auth` section or add it to an existing `auth` chain - but first replace placeholders with your specific values.

```yaml
auth:
  auth-mongodb:
    uri: "mongodb://[username:password@]host1[:port1]/db"
    db: "verdaccio"
    collection: "users"
    encryption: "bcrypt"
    userIsUnique: true
    fields:
      username:   "username"
      password:   "password"
      usergroups: "usergroups"
```

Configuration options
* `uri`: The MongoDB-like URI including admin username, password and database holding the user collection. [REQUIRED]
* `database`: The database in the MongoDB holding the user collection [OPTIONAL?]
* `username`: The clear-text name of the admin user who has the necessary roles or rights to insert, update, delete(?), and lookup users in a specific collection (i.e., [user-collection]). [OPTIONAL?]
* `encryption`: The mechanism to encrypt the password (currently supported: `none`, `bcrypt`). Defaults to `bcrypt` [OPTIONAL?]
* `userIsUnique`: Switch to check unique user (currently supported: `true`, `false`). Defaults to `true` [OPTIONAL?]
* `fields`: (name of the fields in the mongodb collection)
  * `username`: Name of the field used to store the unique username (e.g., user, username, email, etc.). Defaults to `username` [OPTIONAL]
  * `password`: Name of the field used to store the password (e.g., pass, password, token, etc.). Defaults to `password` [OPTIONAL]
  * `usergroups`: Name of the field used to store the array of usergroups (e.g., groups, usergroups, roles, etc.). Defaults to `usergroups` [OPTIONAL]

## development

See the [Verdaccio contributing guide](https://github.com/verdaccio/verdaccio/blob/master/CONTRIBUTING.md) for instructions setting up your development environment. 
Once you have completed that, use the following npm tasks.

  - `npm run build`

    Build a distributable archive

  - `npm run test`

    Run unit test

For more information about any of these commands run `npm run ${task} -- --help`.

# Usage Concept

## Register Users
```mermaid
sequenceDiagram  
  User ->>+ Webapp: Start Register
  Webapp ->>+ Stripe: Init Payment
  deactivate Webapp
  Stripe ->>+ Webapp: Payment Result
  deactivate Stripe
  Webapp ->> MongoDB: createUser?
  Webapp ->> User: End Register
  deactivate  Webapp
  Note right of User: WIP: Testing Mermaid!
```

## Authenticate Users

```mermaid
sequenceDiagram
  User ->>+ Verdaccio: Web Login
  loop Until Authenticated
       User ->> Verdaccio: enterUserPassword?
       Verdaccio ->> Verdaccio: encryptPassword?
       Verdaccio ->> MongoDB: lookupUserPassword?
	alt not authenticated  
      Verdaccio -->>+ User: retryLogin
    else authenticated
      Verdaccio -->>+ User: updateToken
	 end
      
  end
  deactivate  Verdaccio
  Note right of User: WIP: Testing Mermaid!
```
