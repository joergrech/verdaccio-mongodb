import { Config } from '@verdaccio/types';

export interface AuthMongoDBConfig extends Config {
  uri: string;
  db: string;
  collection: string;
  encryption?: string;
  userIsUnique?: boolean;
  allowAddUser?: boolean;
  cacheTTL: number;
  adminGroup: string;
  fields?: {
    username?: string;
    password?: string;
    usergroups?: string;
  };
  rights?: {
    access?: string;
    publish?: string;
    unpublish?: string;
  };
}

// export interface MongodbUser {
//   // WARN: field names can be configures and should be dynamic
//   username: string;
//   password: string;
//   usergroups: Array<string>;
// }

// export interface Users {
//   [key: string]: MongodbUser;
// }
