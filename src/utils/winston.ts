import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logFileRotationTransport = new DailyRotateFile({
  filename: path.join(__dirname, '..', 'logs', 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m', // Rotate when log file exceeds 10MB
  maxFiles: '14d', // Keep logs for 14 days
});

const { combine, timestamp, json, prettyPrint, errors } = winston.format;
const logPath = path.join(__dirname, '..', 'logs', 'failed-jobs.log');

const logger = winston.createLogger({
  level: 'info', // default
  format: combine(
    // logs the error stack
    errors({ stack: true }),
    // one liner log record "do it after destructuring the printf method above"
    // printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
    timestamp(),
    json(),
    prettyPrint(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: logPath, level: 'error' }),
    logFileRotationTransport,
  ],
});

export default logger;
