import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';

import { typeOrmProductionConfig } from '../../../../libs/configs/typeorm-production.config';
import { Entities } from 'libs/database/entities';

@Module({
    imports: [
        // 실서버 DB 연결 (데이터 동기화용) - 환경변수로 활성화/비활성화
        TypeOrmModule.forRootAsync({
            name: 'production',
            inject: [ConfigService],
            useFactory: typeOrmProductionConfig,
        }),
        TypeOrmModule.forFeature(Entities),
    ],
    controllers: [MigrationController],
    providers: [MigrationService],
    exports: [MigrationService],
})
export class MigrationModule {}
