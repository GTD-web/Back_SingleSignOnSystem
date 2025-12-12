import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeDepartmentPositionHistory } from './employee-department-position-history.entity';
import { DomainEmployeeDepartmentPositionHistoryRepository } from './employee-department-position-history.repository';
import { DomainEmployeeDepartmentPositionHistoryService } from './employee-department-position-history.service';

@Module({
    imports: [TypeOrmModule.forFeature([EmployeeDepartmentPositionHistory])],
    providers: [DomainEmployeeDepartmentPositionHistoryRepository, DomainEmployeeDepartmentPositionHistoryService],
    exports: [DomainEmployeeDepartmentPositionHistoryService],
})
export class DomainEmployeeDepartmentPositionHistoryModule {}

