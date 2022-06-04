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
let config = {};
let logger;

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function setConfig(newConfig) {
  if (newConfig) {
    config = newConfig;
  }
  return config;
}

function setLogger(newLogger) {
  if (newLogger) {
    logger = newLogger;
  }
  return logger;
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

async function incCounter(activity, username, packagename) {
  if (!config.countActivity) {
    logger.debug(`mongodb: Count is disabled!`);
    return;
  }
  const year = new Date().getUTCFullYear();
  const month = monthNames[new Date().getUTCMonth()];
  const week = getWeekNumber(new Date())
    .toString()
    .padStart(2, '0');

  const client = await connectToDatabase(config.uri);
  const db = await getDb(config.db);

  try {
    await client.connect();
    const users = await db.collection(config.collections.users);
    const lookupQuery = `{ "${config.fields.username}": "${username}" }`;
    const updateCommand = `{ "$inc": {
      "activity.${activity}.${packagename}.count": 1,
      "activity.${activity}.${packagename}.${year}.count": 1,
      "activity.${activity}.${packagename}.${year}.${month}": 1,
      "activity.${activity}.${packagename}.${year}.week_${week}": 1
    } }`;
    await users.update(JSON.parse(lookupQuery), JSON.parse(updateCommand));
    logger.debug(`mongodb: Incremented "activity.${activity}.${packagename}" count for ${username} in MongoDB`);
  } catch (e) {
    logger.error(
      `mongodb: Error when incrementing "activity.${activity}.${packagename}" count for ${username} in MongoDB: ${e}`
    );
  }

  try {
    await client.connect();
    const packages = await db.collection(config.collections.packages);
    const lookupQuery = `{ "${config.fields.packagename}": "${packagename}" }`;
    const updateCommand = `{ "$inc": {
      "activity.${activity}.count": 1,
      "activity.${activity}.${year}.count": 1,
      "activity.${activity}.${year}.${month}": 1,
      "activity.${activity}.${year}.week_${week}": 1
    } }`;
    await packages.update(JSON.parse(lookupQuery), JSON.parse(updateCommand), { upsert: true });
    logger.debug(`mongodb: Incremented "activity.${activity}" count for ${packagename} in MongoDB`);
  } catch (e) {
    logger.error(`mongodb: Error when incrementing "activity.${activity}" counts for ${packagename} in MongoDB: ${e}`);
  }
  // return result;
}

/**
 * For a given date, get the ISO week number
 *
 * Algorithm is to find nearest thursday, it's year
 * is the year of the week number. Then get weeks
 * between that date and the first day of that year.
 *
 * Note that dates in one year can be weeks of previous
 * or next year, overlap is up to 3 days.
 *
 * e.g. 2014/12/29 is Monday in week  1 of 2015
 *      2012/1/1   is Sunday in week 52 of 2011
 */
function getWeekNumber(d) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7 (Monday is first)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  // Return week number only
  return weekNo;
}

module.exports.setConfig = setConfig;
module.exports.setLogger = setLogger;
module.exports.connectToDatabase = connectToDatabase;
module.exports.disposeConnection = disposeConnection;
module.exports.getDb = getDb;
module.exports.incCounter = incCounter;
