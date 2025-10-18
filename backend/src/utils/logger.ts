import winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;

// Môi trường hiện tại (development, production, etc.)
const environment = process.env.NODE_ENV || 'development';

// Định dạng log
const logFormat = printf(({ level, message, timestamp, stack }) => {
  // Nếu có stack trace (lỗi), in nó ra, ngược lại chỉ in message
  const logMessage = stack || message;
  return `${timestamp} [${level}]: ${logMessage}`;
});

const logger = winston.createLogger({
  // Chỉ ghi log ở mức 'info' trở lên ở production, và 'debug' ở development
  level: environment === 'production' ? 'info' : 'debug',
  format: combine(
    // Chỉ thêm màu sắc khi không phải môi trường production
    environment === 'development' ? colorize() : winston.format.uncolorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    align(),
    // Ghi lại stack trace cho các lỗi
    winston.format.errors({ stack: true }),
    logFormat,
  ),
  transports: [
    // Luôn ghi log ra console
    new winston.transports.Console(),
  ],
  // Không thoát ứng dụng khi có lỗi không được bắt
  exitOnError: false,
});

export { logger };
