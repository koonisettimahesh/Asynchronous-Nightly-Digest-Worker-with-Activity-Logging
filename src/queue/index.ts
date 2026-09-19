import IORedis from 'ioredis';
import { Queue } from 'bullmq';

export interface DigestQueueJobData {
  jobId: string;
  payload: {
    type: string;
    simulate_failure?: boolean;
  };
}

export const DIGEST_QUEUE_NAME = 'nightly-digest';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL is not configured');
}

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const digestQueue = new Queue<DigestQueueJobData>(DIGEST_QUEUE_NAME, {
  connection: redisConnection,
});
