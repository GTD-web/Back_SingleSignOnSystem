import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationHistoryMigrationService } from './organization-history-migration.service';
import {
    OrganizationHistoryViewerService,
    November2025OrgView,
    December2025OrgView,
    OrganizationChangeSummary,
} from './organization-history-viewer.service';
import { November2025ValidatorHelper } from './november-2025-validator.helper';

@ApiTags('조직도 이력 마이그레이션')
@Controller('organization-history-migration')
export class OrganizationHistoryMigrationController {
    constructor(
        private readonly orgHistoryMigration: OrganizationHistoryMigrationService,
        private readonly orgHistoryViewer: OrganizationHistoryViewerService,
        private readonly november2025Validator: November2025ValidatorHelper,
    ) {}

    // ==================== 11월 조직도 이력 마이그레이션 ====================

    @Post('november-2025/migrate')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '11월 조직도 이력 마이그레이션 실행',
        description: `
            11월과 12월 조직도를 비교하여 변경된 직원들의 11월 이력을 생성합니다.
            
            처리 내용:
            1. JSON 파일에서 11월 조직도 데이터 로드
            2. DB에서 현재(12월) 이력 데이터 조회
            3. 부서/직책 변경 여부 비교
            4. 변경된 직원만 11월 이력 생성 + 12월 이력 시작일 수정
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
    async migrateNovember2025OrgHistory() {
        return await this.orgHistoryMigration.execute11월조직도이력마이그레이션();
    }

    @Get('november-2025/validate')
    @ApiOperation({
        summary: '11월 조직도 데이터 검증',
        description: 'JSON 파일의 11월 조직도 데이터를 검증합니다 (마이그레이션 실행 전 사전 체크)',
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
                        totalEmployees: { type: 'number', example: 73 },
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

    @Get('november')
    @ApiOperation({
        summary: '11월 조직도 조회',
        description: '2025년 11월 조직도를 계층구조로 조회합니다 (조직개편 이전)',
    })
    @ApiResponse({
        status: 200,
        description: '11월 조직도 조회 성공',
    })
    async get11월조직도(): Promise<November2025OrgView> {
        return await this.orgHistoryViewer.get11월조직도();
    }

    @Get('december')
    @ApiOperation({
        summary: '12월 조직도 조회',
        description: '2025년 12월 조직도를 계층구조로 조회합니다 (조직개편 이후)',
    })
    @ApiResponse({
        status: 200,
        description: '12월 조직도 조회 성공',
    })
    async get12월조직도(): Promise<December2025OrgView> {
        return await this.orgHistoryViewer.get12월조직도();
    }

    @Get('changes')
    @ApiOperation({
        summary: '11월-12월 조직 변화 내역 조회',
        description: '11월과 12월 조직도를 비교하여 부서/직책이 변경된 직원 목록을 조회합니다',
    })
    @ApiResponse({
        status: 200,
        description: '조직 변화 내역 조회 성공',
    })
    async get조직변화내역(): Promise<OrganizationChangeSummary> {
        return await this.orgHistoryViewer.get조직변화내역();
    }
}

