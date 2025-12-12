import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entities } from 'libs/database/entities';

import { OrganizationHistoryMigrationService } from './organization-history-migration.service';
import { OrganizationHistoryViewerService } from './organization-history-viewer.service';
import { November2025LoaderHelper } from './november-2025-loader.helper';
import { November2025ValidatorHelper } from './november-2025-validator.helper';
import { OrganizationHistoryMigrationController } from './organization-history-migration.controller';

/**
 * 조직도 이력 마이그레이션 모듈
 * 11월/12월 조직도 비교 및 이력 생성
 */
@Module({
    imports: [TypeOrmModule.forFeature(Entities)],
    controllers: [OrganizationHistoryMigrationController],
    providers: [
        OrganizationHistoryMigrationService,
        OrganizationHistoryViewerService,
        November2025LoaderHelper,
        November2025ValidatorHelper,
    ],
    exports: [
        OrganizationHistoryMigrationService,
        OrganizationHistoryViewerService,
        November2025LoaderHelper,
        November2025ValidatorHelper,
    ],
})
export class OrganizationHistoryMigrationModule {}

