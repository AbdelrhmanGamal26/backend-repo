import fs from 'fs';
import path from 'path';
import { Job } from 'bullmq';

// will be kept for reference
export const logCompletedJob = (job: Job) => {
  const logPath = path.join(__dirname, 'logs', 'completed-jobs.log');
  const logData = `[${new Date().toISOString()}] ${job.name}: ${JSON.stringify(job.data)}\n`;
  fs.appendFileSync(logPath, logData);
};

export const logFailedJob = (job: Job, err: Error) => {
  const logPath = path.join(__dirname, 'logs', 'failed-jobs.log');
  const logData =
    `[${new Date().toISOString()}] Job "${job.name}" FAILED\n` +
    `Error: ${err.message}\n` +
    `Data: ${JSON.stringify(job.data)}\n\n`;
  fs.appendFileSync(logPath, logData);
};
