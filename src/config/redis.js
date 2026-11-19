const IORedis = require('ioredis');
const logger = require('./logger');


const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null, // Required by BullMQ so workers don't crash on brief pauses
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis successfully');
});

redisConnection.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

module.exports = redisConnection;