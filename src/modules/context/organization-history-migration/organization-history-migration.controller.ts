import { Controller, Post, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { OrganizationHistoryMigrationService } from './organization-history-migration.service';

@ApiTags('조직도 이력 마이그레이션')
@Controller('organization-history-migration')
export class OrganizationHistoryMigrationController {
    constructor(private readonly orgHistoryMigration: OrganizationHistoryMigrationService) {}

    // ==================== 통합 마이그레이션 ====================

    @Post('execute')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '조직도 이력 통합 마이그레이션 실행',
        description: `
            11월-12월 조직도 이력을 순차적으로 마이그레이션합니다.
            
            실행 순서:
            1. 기존 이력 삭제
               - assignmentReason이 "초기 데이터 마이그레이션"이 아닌 이력만 삭제
               - 초기 마이그레이션 데이터는 유지
            
            2. 11월 조직도 마이그레이션
               - JSON 파일에서 11월 조직도 데이터 로드
               - 각 직원의 11월 배치 이력 생성 (effectiveStartDate: hireDate, effectiveEndDate: 2025-11-30)
               - 실제 배치이력 생성 로직(직원의_배치이력을_생성한다) 활용
            
            3. 12월 조직도 마이그레이션
               - 11월 조직도와 현재 배치 데이터 비교
               - 변경이 있는 경우에만 12월 이력 생성 (부서/직책/관리자권한/상위부서 변경)
               - 변경이 없는 직원은 11월 이력이 계속 유효 (isCurrent 유지)
               - 12월 이후 신규 입사자는 입사일부터 이력 생성
               - 실제 배치이력 생성 로직 활용
            
            주의: 기존 이력이 모두 삭제되므로 신중하게 실행하세요.
        `,
    })
    @ApiResponse({
        status: 200,
        description: '마이그레이션 성공',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                deletedHistories: { type: 'number', example: 150, description: '삭제된 이력 수' },
                november: {
                    type: 'object',
                    properties: {
                        totalEmployees: { type: 'number', example: 73 },
                        created: { type: 'number', example: 73 },
                        skipped: { type: 'number', example: 0, description: '11월은 전체 생성이므로 항상 0' },
                        errors: { type: 'array', items: { type: 'object' } },
                    },
                },
                december: {
                    type: 'object',
                    properties: {
                        totalEmployees: { type: 'number', example: 73 },
                        created: { type: 'number', example: 15, description: '변경이 있어서 생성된 이력 수' },
                        skipped: { type: 'number', example: 58, description: '변경이 없어서 스킵된 직원 수' },
                        errors: { type: 'array', items: { type: 'object' } },
                    },
                },
                executionTime: { type: 'string', example: '15.3초' },
            },
        },
    })
    async executeMigration() {
        return await this.orgHistoryMigration.execute통합마이그레이션();
    }
}
