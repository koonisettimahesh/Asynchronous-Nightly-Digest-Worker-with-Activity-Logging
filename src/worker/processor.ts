import { randomUUID } from 'crypto';
import { Job } from 'bullmq';
import { pool } from '../api/controllers/shared/config';

export interface DigestJobData {
  jobId: string;
  payload: {
    type: string;
    simulate_failure?: boolean;
  };
}

const updateJobState = async (jobId: string, state: string): Promise<void> => {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }

  await pool.query('UPDATE jobs SET current_state = $1 WHERE id = $2', [state, jobId]);
};

const appendActivityLog = async (jobId: string, state: string, message: string): Promise<void> => {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }

  await pool.query(
    `
      INSERT INTO job_activity_logs (id, job_id, state, message, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `,
    [randomUUID(), jobId, state, message]
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const processDigestJob = async (job: Job<DigestJobData>): Promise<void> => {
  const { jobId, payload } = job.data;

  try {
    await appendActivityLog(jobId, 'started', `Worker picked up job for ${payload.type}`);
    await updateJobState(jobId, 'started');

    if (payload.simulate_failure === true) {
      throw new Error(`Injected failure for job ${jobId}: simulate_failure=true`);
    }

    await wait(2000);

    await updateJobState(jobId, 'success');
    await appendActivityLog(jobId, 'success', `Nightly digest completed successfully for ${payload.type}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown worker error';

    await appendActivityLog(jobId, 'failed', `Job failed: ${message}`);
    await updateJobState(jobId, 'failed');

    await appendActivityLog(jobId, 'dead_letter', `Job moved to dead_letter after failure: ${message}`);
    await updateJobState(jobId, 'dead_letter');
  }
};
