import { Pool } from 'pg';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

export const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
export const redis = redisUrl ? new IORedis(redisUrl) : null;
export const queue = redis && redisUrl ? new Queue('digest_queue', { connection: redis }) : null;
