import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entities } from 'libs/database/entities';

import { OrganizationHistoryMigrationService } from './organization-history-migration.service';
import { November2025LoaderHelper } from './november-2025-loader.helper';
import { OrganizationHistoryMigrationController } from './organization-history-migration.controller';
import { OrganizationManagementContextModule } from '../organization-management/organization-management-context.module';

/**
 * 조직도 이력 마이그레이션 모듈
 * 11월/12월 조직도 비교 및 이력 생성
 */
@Module({
    imports: [TypeOrmModule.forFeature(Entities), OrganizationManagementContextModule],
    controllers: [OrganizationHistoryMigrationController],
    providers: [OrganizationHistoryMigrationService, November2025LoaderHelper],
    exports: [OrganizationHistoryMigrationService, November2025LoaderHelper],
})
export class OrganizationHistoryMigrationModule {}
