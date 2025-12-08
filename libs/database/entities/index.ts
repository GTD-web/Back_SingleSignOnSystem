import { Employee } from '../../../src/modules/domain/employee/employee.entity';
import { Department, DepartmentType } from '../../../src/modules/domain/department/department.entity';
import { Position } from '../../../src/modules/domain/position/position.entity';
import { Rank } from '../../../src/modules/domain/rank/rank.entity';
import { EmployeeDepartmentPosition } from '../../../src/modules/domain/employee-department-position/employee-department-position.entity';
import { EmployeeRankHistory } from '../../../src/modules/domain/employee-rank-history/employee-rank-history.entity';
import { Webhook } from '../../../src/modules/domain/webhook/webhook.entity';
import { WebhookEventLog } from '../../../src/modules/domain/webhook-event-log/webhook-event-log.entity';
import { System } from '../../../src/modules/domain/system/system.entity';
import { Token } from '../../../src/modules/domain/token/token.entity';
import { EmployeeToken } from '../../../src/modules/domain/employee-token/employee-token.entity';
import { SystemWebhook } from '../../../src/modules/domain/system-webhook/system-webhook.entity';
import { Log } from '../../../src/modules/domain/log/log.entity';
import { FcmToken } from '../../../src/modules/domain/fcm-token/fcm-token.entity';
import { EmployeeFcmToken } from '../../../src/modules/domain/employee-fcm-token/employee-fcm-token.entity';
import { SystemRole } from '../../../src/modules/domain/system-role/system-role.entity';
import { EmployeeSystemRole } from '../../../src/modules/domain/employee-system-role/employee-system-role.entity';
import { EmployeeDepartmentPositionHistory } from 'src/modules/domain/employee-department-position-history/employee-department-position-history.entity';
import { DepartmentHistory } from 'src/modules/domain/department-history/department-history.entity';

export {
    Employee,
    Department,
    DepartmentType,
    Position,
    Rank,
    EmployeeDepartmentPosition,
    EmployeeRankHistory,
    Webhook,
    WebhookEventLog,
    System,
    Token,
    EmployeeToken,
    SystemWebhook,
    Log,
    FcmToken,
    EmployeeFcmToken,
    SystemRole,
    EmployeeSystemRole,
    DepartmentHistory,
    EmployeeDepartmentPositionHistory,
};

export const Entities = [
    Employee,
    Department,
    Position,
    Rank,
    EmployeeDepartmentPosition,
    EmployeeRankHistory,
    Webhook,
    WebhookEventLog,
    System,
    Token,
    EmployeeToken,
    SystemWebhook,
    Log,
    FcmToken,
    EmployeeFcmToken,
    SystemRole,
    EmployeeSystemRole,
    DepartmentHistory,
    EmployeeDepartmentPositionHistory,
];
