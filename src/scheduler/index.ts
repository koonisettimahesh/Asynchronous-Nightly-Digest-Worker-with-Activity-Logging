import { randomUUID } from 'crypto';
import cron from 'node-cron';
import { pool } from '../api/controllers/shared/config';
import { digestQueue, DIGEST_QUEUE_NAME } from '../queue';

const cronExpression = process.env.NIGHTLY_DIGEST_CRON || '0 0 * * *';

export const triggerNightlyDigestJob = async (): Promise<string> => {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }

  const jobId = randomUUID();
  const payload = {
    type: 'nightly_digest',
    simulate_failure: false,
  };
  const createdAt = new Date();

  await pool.query(
    `
      INSERT INTO jobs (id, name, payload, current_state, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [jobId, payload.type, JSON.stringify(payload), 'pending', createdAt]
  );

  await pool.query(
    `
      INSERT INTO job_activity_logs (id, job_id, state, message, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [randomUUID(), jobId, 'pending', 'Scheduled nightly digest job created and queued', createdAt]
  );

  await digestQueue.add('nightly_digest', {
    jobId,
    payload,
  });

  console.log(`Scheduled job queued to ${DIGEST_QUEUE_NAME}: ${jobId}`);

  return jobId;
};

export const scheduler = cron.schedule(cronExpression, async () => {
  try {
    console.log('Cron triggered: nightly digest job scheduled');
    await triggerNightlyDigestJob();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown scheduler error';
    console.error('Nightly digest scheduler error:', message);
  }
});

console.log('Nightly digest scheduler started');
scheduler.start();
