import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentHistory } from './department-history.entity';
import { DomainDepartmentHistoryRepository } from './department-history.repository';
import { DomainDepartmentHistoryService } from './department-history.service';

@Module({
    imports: [TypeOrmModule.forFeature([DepartmentHistory])],
    providers: [DomainDepartmentHistoryRepository, DomainDepartmentHistoryService],
    exports: [DomainDepartmentHistoryService],
})
export class DomainDepartmentHistoryModule {}
