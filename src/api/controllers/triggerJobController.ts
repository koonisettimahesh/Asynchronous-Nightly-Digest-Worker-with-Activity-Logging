import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { pool } from './shared/config';
import { digestQueue } from '../../queue';

const validatePayload = (body: any) => {
  const type = typeof body?.type === 'string' ? body.type.trim() : '';
  const simulateFailure = body?.simulate_failure === true;

  if (!type) {
    const error = new Error('type is required');
    (error as any).statusCode = 400;
    throw error;
  }

  return {
    type,
    simulate_failure: simulateFailure,
  };
};

export const triggerJobController = async (req: Request, res: Response) => {
  try {
    const payload = validatePayload(req.body);

    if (!pool) {
      const error = new Error('DATABASE_URL is not configured');
      (error as any).statusCode = 500;
      throw error;
    }


    const jobId = randomUUID();
    const createdAt = new Date();

    await pool.query(
      `
        INSERT INTO jobs (id, name, payload, current_state, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [jobId, payload.type, JSON.stringify({ ...payload }), 'pending', createdAt]
    );

    await pool.query(
      `
        INSERT INTO job_activity_logs (id, job_id, state, message, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [randomUUID(), jobId, 'pending', 'Job created and queued for processing', createdAt]
    );

    await digestQueue.add('nightly_digest', {
      jobId,
      payload,
    });

    return res.status(202).json({
      job_id: jobId,
      message: 'Job queued successfully',
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Failed to queue job',
    });
  }
};
