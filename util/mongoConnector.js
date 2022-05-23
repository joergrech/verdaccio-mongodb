const { MongoClient, ServerApiVersion } = require('mongodb');

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongo;

if (!cached) {
  cached = { conn: null, promise: null, db: null };
  global.mongo = { conn: null, promise: null, db: null };
}

async function connectToDatabase(MONGODB_URI) {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: ServerApiVersion.v1,
    };

    cached.promise = new MongoClient(MONGODB_URI, opts);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

async function disposeConnection() {
  if (cached.conn) {
    cached = { conn: null, promise: null, db: null };
  }
  return cached;
}

async function getDb(MONGODB_DB) {
  if (cached.db) {
    return cached.db;
  }

  cached.db = await cached.conn.db(MONGODB_DB);
  return cached.db;
}

module.exports.connectToDatabase = connectToDatabase;
module.exports.disposeConnection = disposeConnection;
module.exports.getDb = getDb;

// module.exports = {
//   connectToDatabase(MONGODB_URI),
//   getDb(MONGODB_DB)
// };
// export default 'connectToDatabase';
