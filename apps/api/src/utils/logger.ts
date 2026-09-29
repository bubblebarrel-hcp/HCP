import winston from 'winston';
import { env } from '../config/env';

export const logger = winston.createLogger({
  level: env.logLevel,
  format: env.isProduction
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, ...rest }) => {
          const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
          return `${timestamp} ${level} ${message}${extra}`;
        }),
      ),
  transports: [new winston.transports.Console()],
});

export default logger;
