import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiProperty, ApiExcludeController } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { MigrationService } from './migration.service';
import { OrganizationHistoryMigrationService } from './organization-history-migration.service';
import {
    OrganizationHistoryViewerService,
    November2025OrgView,
    December2025OrgView,
    OrganizationChangeSummary,
} from './organization-history-viewer.service';
import { TerminatedEmployeeMigrationService } from './terminated-employee-migration.service';
import { November2025ValidatorHelper } from './november-2025-validator.helper';
import { RegisterNovember2025OrgDto } from './dto';

class SyncDatabaseRequestDto {
    @ApiProperty({
        description: '동기화할 테이블 목록',
        example: [
            'systems',
            'system_roles',
            'ranks',
            'positions',
            'fcm_tokens',
            'tokens',
            'departments',
            'employees',
            'employee_department_positions',
            'employee_rank_histories',
            'employee_tokens',
            'employee_fcm_tokens',
            'employee_system_roles',
        ],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    tables: string[];
}

// @ApiExcludeController()
@ApiTags('Migration - 데이터베이스 동기화')
@Controller('migration')
export class MigrationController {
    constructor(
        private readonly migrationService: MigrationService,
        private readonly orgHistoryMigration: OrganizationHistoryMigrationService,
        private readonly orgHistoryViewer: OrganizationHistoryViewerService,
        private readonly terminatedEmpMigration: TerminatedEmployeeMigrationService,
        private readonly november2025Validator: November2025ValidatorHelper,
    ) {}

    @Post('sync-from-production')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '실서버에서 개발서버로 데이터 동기화',
        description: `
            실서버의 선택된 테이블 데이터를 개발서버로 동기화합니다.
            
            **동기화 순서:**
            1. 외래키 제약조건 임시 비활성화
            2. 실서버 데이터 조회
            3. 개발서버 데이터 삭제 (의존성 역순)
            4. 개발서버에 데이터 입력 (의존성 정순)
            5. 외래키 제약조건 복원
            
            **사용 가능한 테이블:**
            - system_roles: 시스템 역할
            - ranks: 직급
            - positions: 직책
            - fcm_tokens: FCM 토큰
            - departments: 부서 (계층구조 유지)
            - employees: 직원
            - employee_department_positions: 직원-부서-직책 관계
            - employee_rank_histories: 직원 직급 이력
            - employee_tokens: 직원 토큰
            - employee_fcm_tokens: 직원-FCM토큰 관계
            - employee_system_roles: 직원-시스템역할 관계
            
            **주의사항:**
            ⚠️ 이 작업은 개발서버의 데이터를 완전히 삭제하고 실서버 데이터로 대체합니다!
            ⚠️ 트랜잭션으로 처리되므로 실패 시 자동으로 롤백됩니다.
        `,
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                tables: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                        'systems',
                        'system_roles',
                        'ranks',
                        'positions',
                        'fcm_tokens',
                        'tokens',
                        'departments',
                        'employees',
                        'employee_department_positions',
                        'employee_rank_histories',
                        'employee_tokens',
                        'employee_fcm_tokens',
                        'employee_system_roles',
                    ],
                    description: '동기화할 테이블 목록',
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: '동기화 성공',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: '데이터베이스 동기화가 성공적으로 완료되었습니다.' },
                syncedTables: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['departments', 'employees'],
                },
                errors: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [],
                },
            },
        },
    })
    @ApiResponse({
        status: 500,
        description: '동기화 실패',
    })
    async syncFromProduction(@Body() dto: SyncDatabaseRequestDto) {
        console.log(dto);
        return await this.migrationService.syncFromProductionToDevDatabase(dto.tables);
    }

    @Post('november-2025-org-history')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '2025년 11월 조직도 이력 마이그레이션',
        description: `
            11월과 12월 조직도를 비교하여 변경된 직원들의 11월 이력을 생성합니다.
            
            **프로세스:**
            1. 11월 조직도 데이터 로드
            2. 12월 현재 이력 데이터 로드
            3. 두 데이터 비교 (부서, 직책, 직급, 관리자 여부)
            4. 변경된 직원만 처리:
               - 11월 이력 생성 (입사일 ~ 2025-11-30)
               - 12월 이력 수정 (2025-12-01부터 시작)
            
            **주의사항:**
            ⚠️ 이 작업은 트랜잭션으로 처리됩니다.
            ⚠️ 11월 조직도 데이터를 먼저 load11월조직도데이터() 메서드에 입력해야 합니다.
        `,
    })
    @ApiResponse({
        status: 200,
        description: '마이그레이션 성공',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                totalProcessed: { type: 'number', example: 73 },
                changedCount: { type: 'number', example: 15 },
                unchangedCount: { type: 'number', example: 58 },
                createdCount: { type: 'number', example: 15 },
                updatedCount: { type: 'number', example: 15 },
                errors: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            employeeId: { type: 'string' },
                            employeeName: { type: 'string' },
                            error: { type: 'string' },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: 500,
        description: '마이그레이션 실패',
    })
    async migrateNovember2025OrgHistory() {
        return await this.orgHistoryMigration.execute11월조직도이력마이그레이션();
    }

    @Get('november-2025-org-validate')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '2025년 11월 조직도 데이터 검증',
        description: `
            마이그레이션 실행 전 JSON 데이터를 검증합니다.
            
            **검증 항목:**
            1. 부서명 존재 여부 (DB와 매칭)
            2. 직원명 존재 여부 (DB와 매칭)
            3. 겸직자 중복 확인
            4. 통계 정보
            
            **주의사항:**
            ⚠️ 실제 마이그레이션 전에 반드시 실행하여 데이터를 검증하세요.
        `,
    })
    @ApiResponse({
        status: 200,
        description: '검증 완료',
        schema: {
            type: 'object',
            properties: {
                isValid: { type: 'boolean', example: true },
                errors: { type: 'array', items: { type: 'string' } },
                warnings: { type: 'array', items: { type: 'string' } },
                stats: {
                    type: 'object',
                    properties: {
                        totalDepartments: { type: 'number', example: 15 },
                        totalEmployees: { type: 'number', example: 70 },
                        missingDepartments: { type: 'array', items: { type: 'string' } },
                        missingEmployees: { type: 'array', items: { type: 'string' } },
                        duplicateEmployees: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    count: { type: 'number' },
                                    departments: { type: 'array', items: { type: 'string' } },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    async validateNovember2025OrgData() {
        return await this.november2025Validator.validateJsonData();
    }

    // ==================== 조직도 이력 조회 ====================

    @Get('org-history/november')
    @ApiOperation({
        summary: '11월 조직도 조회',
        description: '2025년 11월 조직도를 계층구조로 조회합니다 (조직개편 이전)',
    })
    @ApiResponse({
        status: 200,
        description: '11월 조직도 조회 성공',
        schema: {
            type: 'object',
            properties: {
                effectiveDate: { type: 'string', example: '2025-11-30' },
                description: { type: 'string', example: '2025년 11월 조직도 (조직개편 이전)' },
                totalDepartments: { type: 'number', example: 15 },
                totalEmployees: { type: 'number', example: 73 },
                organization: {
                    type: 'object',
                    properties: {
                        departmentId: { type: 'string' },
                        departmentCode: { type: 'string' },
                        departmentName: { type: 'string' },
                        departmentType: { type: 'string' },
                        level: { type: 'number' },
                        parentDepartmentId: { type: 'string', nullable: true },
                        employees: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    employeeId: { type: 'string' },
                                    employeeNumber: { type: 'string' },
                                    employeeName: { type: 'string' },
                                    positionTitle: { type: 'string' },
                                    positionCode: { type: 'string' },
                                    rankName: { type: 'string', nullable: true },
                                    rankCode: { type: 'string', nullable: true },
                                    isManager: { type: 'boolean' },
                                },
                            },
                        },
                        children: {
                            type: 'array',
                            description: '하위 부서 (재귀 구조)',
                        },
                    },
                },
            },
        },
    })
    async get11월조직도(): Promise<November2025OrgView> {
        return await this.orgHistoryViewer.get11월조직도();
    }

    @Get('org-history/december')
    @ApiOperation({
        summary: '12월 조직도 조회',
        description: '2025년 12월 조직도를 계층구조로 조회합니다 (조직개편 이후)',
    })
    @ApiResponse({
        status: 200,
        description: '12월 조직도 조회 성공',
        schema: {
            type: 'object',
            properties: {
                effectiveDate: { type: 'string', example: '2025-12-01' },
                description: { type: 'string', example: '2025년 12월 조직도 (조직개편 이후)' },
                totalDepartments: { type: 'number', example: 15 },
                totalEmployees: { type: 'number', example: 73 },
                organization: {
                    type: 'object',
                    properties: {
                        departmentId: { type: 'string' },
                        departmentCode: { type: 'string' },
                        departmentName: { type: 'string' },
                        departmentType: { type: 'string' },
                        level: { type: 'number' },
                        parentDepartmentId: { type: 'string', nullable: true },
                        employees: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    employeeId: { type: 'string' },
                                    employeeNumber: { type: 'string' },
                                    employeeName: { type: 'string' },
                                    positionTitle: { type: 'string' },
                                    positionCode: { type: 'string' },
                                    rankName: { type: 'string', nullable: true },
                                    rankCode: { type: 'string', nullable: true },
                                    isManager: { type: 'boolean' },
                                },
                            },
                        },
                        children: {
                            type: 'array',
                            description: '하위 부서 (재귀 구조)',
                        },
                    },
                },
            },
        },
    })
    async get12월조직도(): Promise<December2025OrgView> {
        return await this.orgHistoryViewer.get12월조직도();
    }

    @Get('org-history/changes')
    @ApiOperation({
        summary: '11월-12월 조직 변화 내역 조회',
        description: '11월과 12월 조직도를 비교하여 부서/직책이 변경된 직원 목록을 조회합니다',
    })
    @ApiResponse({
        status: 200,
        description: '조직 변화 내역 조회 성공',
        schema: {
            type: 'object',
            properties: {
                totalChanges: { type: 'number', example: 15 },
                departmentChanges: { type: 'number', example: 12 },
                positionChanges: { type: 'number', example: 5 },
                bothChanges: { type: 'number', example: 2 },
                changes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            employeeId: { type: 'string' },
                            employeeNumber: { type: 'string' },
                            employeeName: { type: 'string' },
                            changeType: {
                                type: 'string',
                                enum: ['DEPARTMENT_CHANGE', 'POSITION_CHANGE', 'BOTH_CHANGE'],
                            },
                            november: {
                                type: 'object',
                                properties: {
                                    departmentName: { type: 'string' },
                                    departmentCode: { type: 'string' },
                                    positionTitle: { type: 'string' },
                                    positionCode: { type: 'string' },
                                    rankName: { type: 'string', nullable: true },
                                    isManager: { type: 'boolean' },
                                },
                            },
                            december: {
                                type: 'object',
                                properties: {
                                    departmentName: { type: 'string' },
                                    departmentCode: { type: 'string' },
                                    positionTitle: { type: 'string' },
                                    positionCode: { type: 'string' },
                                    rankName: { type: 'string', nullable: true },
                                    isManager: { type: 'boolean' },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    async get조직변화내역(): Promise<OrganizationChangeSummary> {
        return await this.orgHistoryViewer.get조직변화내역();
    }

    // ==================== 퇴사자 데이터 마이그레이션 ====================

    @Post('terminated-employees/migrate')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '퇴사자 데이터 마이그레이션',
        description: `
            퇴사자의 퇴사일 및 이력 데이터를 정리합니다.
            
            처리 내용:
            1. 퇴사일 업데이트 (예상퇴사일로)
            2. 퇴사자 부서 이력을 isCurrent = true로 설정
            3. 다른 부서 이력들을 isCurrent = false로 설정 (유효기간: 입사일 ~ 퇴사일)
            4. 퇴사자 부서가 아닌 배치 데이터 삭제
            
            ※ 퇴사자 데이터는 terminated-employees-data.json 파일에서 자동으로 로드됩니다.
        `,
    })
    @ApiResponse({
        status: 200,
        description: '마이그레이션 성공',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                totalProcessed: { type: 'number', example: 10 },
                successCount: { type: 'number', example: 9 },
                failedCount: { type: 'number', example: 1 },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            employeeNumber: { type: 'string' },
                            employeeName: { type: 'string' },
                            success: { type: 'boolean' },
                            error: { type: 'string' },
                            updates: {
                                type: 'object',
                                properties: {
                                    terminationDateUpdated: { type: 'boolean' },
                                    terminatedDeptHistorySetCurrent: { type: 'boolean' },
                                    otherHistoriesUpdated: { type: 'number' },
                                    assignmentsDeleted: { type: 'number' },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    async migrateTerminatedEmployees() {
        return await this.terminatedEmpMigration.execute퇴사자데이터마이그레이션();
    }

    @Get('terminated-employees/status')
    @ApiOperation({
        summary: '퇴사자 현황 조회',
        description: '퇴사 상태인 직원들의 현재 배치 및 이력 상태를 조회합니다.',
    })
    @ApiResponse({
        status: 200,
        description: '퇴사자 현황 조회 성공',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    employeeId: { type: 'string' },
                    employeeNumber: { type: 'string' },
                    employeeName: { type: 'string' },
                    terminationDate: { type: 'string', nullable: true },
                    currentDepartment: { type: 'string' },
                    currentDepartmentId: { type: 'string' },
                    hasMultipleAssignments: { type: 'boolean' },
                    historyCount: { type: 'number' },
                },
            },
        },
    })
    async getTerminatedEmployeesStatus() {
        return await this.terminatedEmpMigration.get퇴사자현황();
    }
}
