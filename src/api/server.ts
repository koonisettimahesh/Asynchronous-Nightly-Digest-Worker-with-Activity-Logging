import '../scheduler';
import express from 'express';
import { Router } from 'express';
import { triggerJobController } from './controllers/triggerJobController';
import { getJobLogsController } from './controllers/getJobLogsController';

const app = express();
const port = Number(process.env.PORT) || 3000;
const jobsRouter = Router();

jobsRouter.post('/trigger', triggerJobController);
jobsRouter.get('/:job_id/logs', getJobLogsController);

app.use(express.json());
app.use('/api/jobs', jobsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
