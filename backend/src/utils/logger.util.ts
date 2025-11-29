import winston from 'winston';
// import path from 'path';
// import fs from 'fs';

const { combine, timestamp, printf, colorize, align } = winston.format;

const environment = process.env.NODE_ENV || 'development';

// // Ensure logs directory exists
// const logDir = 'logs';
// if (!fs.existsSync(logDir)) {
//   fs.mkdirSync(logDir);
// }

const logFormat = printf(({ level, message, timestamp, stack }) => {
  const logMessage = stack || message;
  return `${timestamp} [${level}]: ${logMessage}`;
});

const logger = winston.createLogger({
  level: environment === 'production' ? 'info' : 'debug',
  format: combine(
    environment === 'development' ? colorize() : winston.format.uncolorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    align(),
    winston.format.errors({ stack: true }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console(),
    // new winston.transports.File({ filename: path.join('logs', 'error.log'), level: 'error' }),
    // new winston.transports.File({ filename: path.join('logs', 'app.log') }),
  ],
  exitOnError: false,
});

export { logger };
