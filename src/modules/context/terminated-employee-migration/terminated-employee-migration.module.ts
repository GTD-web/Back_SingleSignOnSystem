import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entities } from 'libs/database/entities';

import { TerminatedEmployeeMigrationService } from './terminated-employee-migration.service';
import { TerminatedEmployeeMigrationController } from './terminated-employee-migration.controller';

/**
 * 퇴사자 데이터 마이그레이션 모듈
 * 퇴사일 및 이력 데이터 정리
 */
@Module({
    imports: [TypeOrmModule.forFeature(Entities)],
    controllers: [TerminatedEmployeeMigrationController],
    providers: [TerminatedEmployeeMigrationService],
    exports: [TerminatedEmployeeMigrationService],
})
export class TerminatedEmployeeMigrationModule {}

