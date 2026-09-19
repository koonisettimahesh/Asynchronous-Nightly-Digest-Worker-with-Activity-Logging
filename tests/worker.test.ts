import { describe, it, expect, vi } from 'vitest';
import { processDigestJob } from '../src/worker/processor';
import { pool } from '../src/api/controllers/shared/config';

describe('worker processing', () => {
  it('success path logs pending -> started -> success', async () => {
    const query = vi.spyOn(pool as any, 'query').mockResolvedValue({ rows: [], rowCount: 1 });

    await processDigestJob({
      data: {
        jobId: 'job-success',
        payload: {
          type: 'nightly_digest',
          simulate_failure: false,
        },
      },
    } as any);

    const states = query.mock.calls
      .filter(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_activity_logs'))
      .map(([, values]) => values[2]);

    expect(states).toContain('started');
    expect(states).toContain('success');

    const stateUpdates = query.mock.calls
      .filter(([sql]) => typeof sql === 'string' && sql.includes('UPDATE jobs'))
      .map(([, values]) => values[0]);

    expect(stateUpdates).toContain('started');
    expect(stateUpdates).toContain('success');
  });

  it('failure path logs pending -> started -> failed -> dead_letter', async () => {
    const query = vi.spyOn(pool as any, 'query').mockResolvedValue({ rows: [], rowCount: 1 });

    await processDigestJob({
      data: {
        jobId: 'job-failure',
        payload: {
          type: 'nightly_digest',
          simulate_failure: true,
        },
      },
    } as any);

    const logStates = query.mock.calls
      .filter(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO job_activity_logs'))
      .map(([, values]) => values[2]);

    expect(logStates).toContain('started');
    expect(logStates).toContain('failed');
    expect(logStates).toContain('dead_letter');

    const stateUpdates = query.mock.calls
      .filter(([sql]) => typeof sql === 'string' && sql.includes('UPDATE jobs'))
      .map(([, values]) => values[0]);

    expect(stateUpdates).toContain('started');
    expect(stateUpdates).toContain('failed');
    expect(stateUpdates).toContain('dead_letter');
  });
});
