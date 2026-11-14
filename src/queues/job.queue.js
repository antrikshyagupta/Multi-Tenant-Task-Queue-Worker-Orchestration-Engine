const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

// Create a queue named 'background-jobs' backed by our Redis connection
const jobQueue = new Queue('background-jobs', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Automatically retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 1000, // Wait 1s before 1st retry, 2s before 2nd, 4s before 3rd
    },
    removeOnComplete: 100, // Keep the last 100 completed jobs in Redis memory
    removeOnFail: 500,     // Keep the last 500 failed jobs for debugging
  },
});

module.exports = jobQueue;