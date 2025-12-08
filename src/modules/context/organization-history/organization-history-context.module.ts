import { Module } from '@nestjs/common';
import { OrganizationHistoryContextService } from './organization-history-context.service';
import { DomainDepartmentHistoryModule } from '../../domain/department-history/department-history.module';
import { DomainEmployeeDepartmentPositionHistoryModule } from '../../domain/employee-department-position-history/employee-department-position-history.module';

@Module({
    imports: [DomainDepartmentHistoryModule, DomainEmployeeDepartmentPositionHistoryModule],
    providers: [OrganizationHistoryContextService],
    exports: [OrganizationHistoryContextService],
})
export class OrganizationHistoryContextModule {}

