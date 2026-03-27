const { createClient } = require('redis');

let client = null;

const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn('[Redis] REDIS_URL not set — skipping Redis connection (memory adapter will be used).');
    return null;
  }
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => console.error('[Redis] Error:', err.message));
  await client.connect();
  console.log('[Redis] Connected.');
  return client;
};

const getRedisClient = () => client;

module.exports = { connectRedis, getRedisClient };
