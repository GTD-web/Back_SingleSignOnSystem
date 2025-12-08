import { Module } from '@nestjs/common';

// Facade Context
import { OrganizationManagementContextService } from './organization-management-context.service';

// 분리된 Context Services
import { EmployeeManagementContextService } from './employee-management-context.service';
import { DepartmentManagementContextService } from './department-management-context.service';
import { PositionManagementContextService } from './position-management-context.service';
import { RankManagementContextService } from './rank-management-context.service';
import { AssignmentManagementContextService } from './assignment-management-context.service';
import { OrganizationQueryService } from './organization-query.service';

// 조직 관리 관련 도메인 모듈들 import
import { DomainEmployeeModule } from '../../domain/employee/employee.module';
import { DomainDepartmentModule } from '../../domain/department/department.module';
import { DomainPositionModule } from '../../domain/position/position.module';
import { DomainRankModule } from '../../domain/rank/rank.module';
import { DomainEmployeeDepartmentPositionModule } from '../../domain/employee-department-position/employee-department-position.module';
import { DomainEmployeeRankHistoryModule } from '../../domain/employee-rank-history/employee-rank-history.module';
import { DomainEmployeeTokenModule } from '../../domain/employee-token/employee-token.module';
import { DomainEmployeeFcmTokenModule } from '../../domain/employee-fcm-token/employee-fcm-token.module';
import { DomainEmployeeSystemRoleModule } from '../../domain/employee-system-role/employee-system-role.module';

@Module({
    imports: [
        DomainEmployeeModule,
        DomainDepartmentModule,
        DomainPositionModule,
        DomainRankModule,
        DomainEmployeeDepartmentPositionModule,
        DomainEmployeeRankHistoryModule,
        DomainEmployeeTokenModule,
        DomainEmployeeFcmTokenModule,
        DomainEmployeeSystemRoleModule,
    ],
    providers: [
        // 분리된 Context Services
        EmployeeManagementContextService,
        DepartmentManagementContextService,
        PositionManagementContextService,
        RankManagementContextService,
        AssignmentManagementContextService,
        OrganizationQueryService,
        
        // Facade (기존 인터페이스 유지)
        OrganizationManagementContextService,
    ],
    exports: [
        // Facade만 export (하위 호환성 유지)
        OrganizationManagementContextService,
        
        // 필요시 개별 Context도 export 가능
        EmployeeManagementContextService,
        DepartmentManagementContextService,
        PositionManagementContextService,
        RankManagementContextService,
        AssignmentManagementContextService,
        OrganizationQueryService,
    ],
})
export class OrganizationManagementContextModule {}
