import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { OrganizationHistoryMigrationService } from './organization-history-migration.service';
import { OrganizationHistoryViewerService } from './organization-history-viewer.service';
import { TerminatedEmployeeMigrationService } from './terminated-employee-migration.service';
import { November2025LoaderHelper } from './november-2025-loader.helper';
import { November2025ValidatorHelper } from './november-2025-validator.helper';

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
    providers: [
        MigrationService,
        OrganizationHistoryMigrationService,
        OrganizationHistoryViewerService,
        TerminatedEmployeeMigrationService,
        November2025LoaderHelper,
        November2025ValidatorHelper,
    ],
    exports: [
        MigrationService,
        OrganizationHistoryMigrationService,
        OrganizationHistoryViewerService,
        TerminatedEmployeeMigrationService,
        November2025LoaderHelper,
        November2025ValidatorHelper,
    ],
})
export class MigrationModule {}
