import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processDigestJob } from './processor';
import { DIGEST_QUEUE_NAME } from '../queue';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL is not configured');
}

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
    DIGEST_QUEUE_NAME,
  async (job) => {
    await processDigestJob(job);
  },
  { connection }
);

worker.on('ready', () => {
  console.log('BullMQ worker ready and listening for jobs');
});

worker.on('error', (error) => {
  console.error('BullMQ worker error:', error);
});

worker.on('completed', (job) => {
  console.log(`Worker processed job ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`Worker failed job ${job?.id}:`, error.message);
});

console.log('BullMQ worker started');
