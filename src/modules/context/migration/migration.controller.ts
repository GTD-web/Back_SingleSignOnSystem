import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { MigrationService } from './migration.service';

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
            'employee_department_position_history',
            'department_history',
        ],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    tables: string[];
}

@ApiTags('Migration - 데이터베이스 동기화')
@Controller('migration')
export class MigrationController {
    constructor(private readonly migrationService: MigrationService) {}

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
                        'employee_department_position_history',
                        'department_history',
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
}
