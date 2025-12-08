import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers
import { DepartmentController } from './controllers/department.controller';
import { EmployeeController } from './controllers/employee.controller';
import { PositionController } from './controllers/position.controller';
import { RankController } from './controllers/rank.controller';
import { AssignmentController } from './controllers/assignment.controller';

// Business Services
import { DepartmentApplicationService } from './services/department-application.service';
import { EmployeeApplicationService } from './services/employee-application.service';
import { PositionApplicationService } from './services/position-application.service';
import { RankApplicationService } from './services/rank-application.service';
import { AssignmentApplicationService } from './services/assignment-application.service';

// Context Modules
import { OrganizationManagementContextModule } from '../../../context/organization-management/organization-management-context.module';
import { OrganizationHistoryContextModule } from '../../../context/organization-history/organization-history-context.module';
import { SystemManagementContextModule } from '../../../context/system-management/system-management-context.module';

@Module({
    imports: [
        // Context 모듈들
        OrganizationManagementContextModule,
        OrganizationHistoryContextModule,
        SystemManagementContextModule,
    ],
    controllers: [
        // 관심사별로 분리된 컨트롤러들
        DepartmentController,
        EmployeeController,
        PositionController,
        RankController,
        AssignmentController,
    ],
    providers: [
        // Business Services (트랜잭션 관리 레이어)
        DepartmentApplicationService,
        EmployeeApplicationService,
        PositionApplicationService,
        RankApplicationService,
        AssignmentApplicationService,
    ],
    exports: [
        // 다른 모듈에서 사용 가능하도록 export
        DepartmentApplicationService,
        EmployeeApplicationService,
        PositionApplicationService,
        RankApplicationService,
        AssignmentApplicationService,
    ],
})
export class OrganizationModule {}
