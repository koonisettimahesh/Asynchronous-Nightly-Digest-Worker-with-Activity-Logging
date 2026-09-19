import { Request, Response } from 'express';
import { pool } from './shared/config';

export const getJobLogsController = async (req: Request, res: Response) => {
  try {
    const { job_id } = req.params;

    if (!pool) {
      const error = new Error('DATABASE_URL is not configured');
      (error as any).statusCode = 500;
      throw error;
    }

    const jobResult = await pool.query(
      `SELECT id, current_state FROM jobs WHERE id = $1 LIMIT 1`,
      [job_id]
    );

    if (jobResult.rowCount === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const logsResult = await pool.query(
      `
        SELECT state, message, created_at
        FROM job_activity_logs
        WHERE job_id = $1
        ORDER BY created_at ASC
      `,
      [job_id]
    );

    const latestState = logsResult.rows.length
      ? logsResult.rows[logsResult.rows.length - 1].state
      : jobResult.rows[0].current_state;

    return res.status(200).json({
      job_id,
      current_state: latestState,
      logs: logsResult.rows.map((row) => ({
        state: row.state,
        message: row.message,
        created_at: row.created_at,
      })),
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Failed to fetch job logs',
    });
  }
};
