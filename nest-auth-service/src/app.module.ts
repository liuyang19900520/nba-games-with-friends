import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    // 环境变量配置
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [databaseConfig],
    }),

    // TypeORM 配置
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const options = config.get<TypeOrmModuleOptions>('database');
        if (!options) {
          throw new Error('Database configuration is missing');
        }
        return options;
      },
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
