import { describe, it, expect, beforeEach, vi } from 'vitest';
import { triggerJobController } from '../src/api/controllers/triggerJobController';
import { getJobLogsController } from '../src/api/controllers/getJobLogsController';
import { pool } from '../src/api/controllers/shared/config';

const makeRes = () => {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

describe('jobs API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/jobs/trigger returns 202 and creates a pending job log', async () => {
    const query = vi.spyOn(pool as any, 'query').mockResolvedValue({ rowCount: 1, rows: [] });

    const req: any = {
      body: {
        type: 'nightly_digest',
        simulate_failure: false,
      },
    };

    const res = makeRes();

    await triggerJobController(req, res);

    expect(res.statusCode).toBe(202);
    expect(res.body.job_id).toBeTruthy();
    expect(res.body.message).toBe('Job queued successfully');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1][3]).toBe('pending');
    expect(query.mock.calls[1][1][2]).toBe('pending');
  });

  it('POST /api/jobs/trigger rejects invalid requests', async () => {
    const req: any = { body: {} };
    const res = makeRes();

    await triggerJobController(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('type is required');
  });

  it('GET /api/jobs/:job_id/logs returns existing job logs', async () => {
    const query = vi.spyOn(pool as any, 'query')
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'job-1', current_state: 'pending' }] })
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { state: 'pending', message: 'created', created_at: '2025-01-01T00:00:00.000Z' },
          { state: 'started', message: 'worker started', created_at: '2025-01-01T00:00:01.000Z' },
        ],
      });

    const req: any = {
      params: { job_id: 'job-1' },
    };
    const res = makeRes();

    await getJobLogsController(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.job_id).toBe('job-1');
    expect(res.body.logs[0].state).toBe('pending');
    expect(res.body.logs[1].state).toBe('started');
    expect(res.body.logs).toHaveLength(2);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('GET /api/jobs/:job_id/logs returns 404 for missing jobs', async () => {
    vi.spyOn(pool as any, 'query').mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const req: any = { params: { job_id: 'missing-job' } };
    const res = makeRes();

    await getJobLogsController(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Job not found');
  });
});
