import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { Entities } from './libs/database/entities';
import { join } from 'path';
import envConfig from './libs/configs/env.config';

// 환경변수 로드
config();

const configService = new ConfigService({
    load: [envConfig],
});

// 환경변수 직접 접근 (fallback)
const dbConfig = {
    host: configService.get('database.host') || process.env.POSTGRES_HOST || 'localhost',
    port: configService.get('database.port') || parseInt(process.env.POSTGRES_PORT || '5432') || 5432,
    username: configService.get('database.username') || process.env.POSTGRES_USER || 'admin',
    password: configService.get('database.password') || process.env.POSTGRES_PASSWORD || 'tech7admin!',
    database: configService.get('database.database') || process.env.POSTGRES_DATABASE || 'sso-db',
    schema: configService.get('database.schema') || process.env.POSTGRES_SCHEMA || 'public',
};

// 디버깅용 로그 (마이그레이션 실행 시만)
console.log('Database Config:', {
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password ? '***' : 'UNDEFINED',
    database: dbConfig.database,
    schema: dbConfig.schema,
});

export default new DataSource({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: String(dbConfig.password), // 명시적으로 문자열 변환
    database: dbConfig.database,
    schema: dbConfig.schema,
    entities: Entities,
    migrations: [join(__dirname, 'libs/common/migrations/*.ts')],
    synchronize: false,
    logging: configService.get('NODE_ENV') !== 'production',
    ssl: dbConfig.port === 6543,
    extra: {
        ssl: dbConfig.port === 6543 ? { rejectUnauthorized: false } : null,
    },
});
