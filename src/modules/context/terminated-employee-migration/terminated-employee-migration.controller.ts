import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TerminatedEmployeeMigrationService } from './terminated-employee-migration.service';

@ApiTags('퇴사자 데이터 마이그레이션')
@Controller('terminated-employee-migration')
export class TerminatedEmployeeMigrationController {
    constructor(private readonly terminatedEmpMigration: TerminatedEmployeeMigrationService) {}

    @Post('migrate')
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
                totalProcessed: { type: 'number', example: 167 },
                successCount: { type: 'number', example: 165 },
                failedCount: { type: 'number', example: 2 },
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

    @Get('status')
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

