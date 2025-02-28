// src/logger/logger.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // useFactory: (configService: ConfigService) => configService.get('logger'),
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
