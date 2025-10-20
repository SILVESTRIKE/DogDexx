import winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;

const environment = process.env.NODE_ENV || 'development';

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
  ],
  exitOnError: false,
});

export { logger };
