// src/config/logger.config.ts
import { registerAs } from '@nestjs/config';
import { format, transports } from 'winston';

export default registerAs('logger', () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    format: format.combine(
      format.timestamp(),
      format.json(),
      format.prettyPrint(),
    ),
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.timestamp(),
          format.printf(({ timestamp, level, message, context, trace }) => {
            return `${timestamp} [${context}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
          }),
        ),
      }),
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new transports.File({
        filename: 'logs/combined.log',
      }),
    ],
  };
});
