import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Entities } from '../database/entities';
import { join } from 'path';

export const typeOrmConfig = (configService: ConfigService): TypeOrmModuleOptions => {
    const isProduction = configService.get('NODE_ENV') === 'production';
    const isVercel = configService.get('database.port') === 6543;

    return {
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: Entities,
        schema: configService.get('database.schema'),
        synchronize: true, // 마이그레이션 사용을 위해 false로 설정
        // logging: !isProduction,
        // migrations: [join(__dirname, '../common/migrations/*.ts')],
        // migrationsRun: isVercel, // Vercel 환경에서 자동 마이그레이션
        // ssl: isVercel,
        // extra: {
        //     ssl: isVercel ? { rejectUnauthorized: false } : null,
        // },
    };
};
