import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DomainEmployeeService } from '../../domain/employee/employee.service';
import { DomainDepartmentService } from '../../domain/department/department.service';
import { DomainPositionService } from '../../domain/position/position.service';
import { DomainRankService } from '../../domain/rank/rank.service';
import { DomainEmployeeDepartmentPositionService } from '../../domain/employee-department-position/employee-department-position.service';
import { DomainEmployeeRankHistoryService } from '../../domain/employee-rank-history/employee-rank-history.service';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import axios from 'axios';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { PositionResponseDto } from './dto/position-response.dto';
import { RankResponseDto } from './dto/rank-response.dto';
import { EmployeeStatus, Gender } from '../../../../libs/common/enums';
import {
    Employee,
    Department,
    Position,
    Rank,
    EmployeeDepartmentPosition,
    EmployeeRankHistory,
    EmployeeToken,
    FcmToken,
    EmployeeFcmToken,
    SystemRole,
    EmployeeSystemRole,
    System,
    Token,
} from '../../../../libs/database/entities';
import { EmployeeDepartmentPositionHistory } from '../../domain/employee-department-position-history/employee-department-position-history.entity';
import { DepartmentHistory } from '../../domain/department-history/department-history.entity';

@Injectable()
export class MigrationService {
    private readonly logger = new Logger(MigrationService.name);

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        @InjectDataSource('production') private readonly productionDataSource: DataSource,
    ) {}

    // ==================== 데이터베이스 동기화 ====================

    /**
     * 실서버에서 개발서버로 데이터 동기화
     * @param tables 동기화할 테이블 목록 (예: ['employees', 'departments'])
     */
    async syncFromProductionToDevDatabase(tables: string[]): Promise<{
        success: boolean;
        message: string;
        syncedTables: string[];
        errors: string[];
    }> {
        // 실서버 DB 연결 확인
        if (!this.productionDataSource) {
            this.logger.error('❌ 실서버 DB 연결이 활성화되지 않았습니다.');
            return {
                success: false,
                message:
                    '실서버 DB 연결이 활성화되지 않았습니다. ENABLE_PRODUCTION_DB=true를 설정하고 애플리케이션을 재시작하세요.',
                syncedTables: [],
                errors: ['실서버 DB 연결 없음'],
            };
        }

        const syncedTables: string[] = [];
        const errors: string[] = [];

        this.logger.log('🚀 데이터베이스 동기화 시작...');
        this.logger.log(`동기화 대상 테이블: ${tables.join(', ')}`);

        try {
            // 트랜잭션으로 전체 작업 수행
            await this.dataSource.transaction(async (manager) => {
                try {
                    // STEP 1: 외래키 제약조건 임시 비활성화
                    this.logger.log('⏳ 외래키 제약조건 비활성화 중...');
                    await manager.query('SET session_replication_role = replica');

                    // STEP 2: 실서버에서 데이터 조회
                    this.logger.log('📥 실서버 데이터 조회 중...');
                    const productionData = await this.fetchProductionDataByTables(tables);
                    // return;
                    // STEP 3: 개발서버 데이터 삭제 (역순)
                    this.logger.log('🗑️  개발서버 데이터 삭제 중...');
                    await this.deleteDataInReverseOrder(manager, tables);

                    // STEP 4: 개발서버에 데이터 입력 (정순)
                    this.logger.log('💾 개발서버에 데이터 입력 중...');
                    await this.insertDataInCorrectOrder(manager, productionData, tables);

                    syncedTables.push(...tables);

                    // // STEP 5: 외래키 제약조건 복원
                    this.logger.log('✅ 외래키 제약조건 복원 중...');
                    await manager.query('SET session_replication_role = DEFAULT');

                    this.logger.log('✅ 데이터베이스 동기화 완료!');
                } catch (error) {
                    this.logger.error('❌ 동기화 실패:', error);
                    throw error; // 트랜잭션 롤백
                }
            });

            return {
                success: true,
                message: '데이터베이스 동기화가 성공적으로 완료되었습니다.',
                syncedTables,
                errors,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            this.logger.error('❌ 동기화 트랜잭션 실패:', errorMessage);
            errors.push(errorMessage);

            return {
                success: false,
                message: '데이터베이스 동기화 중 오류가 발생했습니다.',
                syncedTables: [],
                errors,
            };
        }
    }

    /**
     * 실서버에서 데이터 조회
     */
    private async fetchProductionDataByTables(tables: string[]): Promise<Map<string, any[]>> {
        const dataMap = new Map<string, any[]>();

        // 실서버 DB 연결 사용 (이미 위에서 null 체크함)
        const productionDataSource = this.productionDataSource!;

        for (const table of tables) {
            try {
                let data: any[] = [];

                switch (table) {
                    case 'systems':
                        data = await productionDataSource.getRepository(System).find();
                        break;
                    case 'tokens':
                        data = await productionDataSource.getRepository(Token).find();
                        break;
                    case 'system_roles':
                        data = await productionDataSource.getRepository(SystemRole).find();
                        break;
                    case 'ranks':
                        data = await productionDataSource.getRepository(Rank).find();
                        break;
                    case 'positions':
                        data = await productionDataSource.getRepository(Position).find();
                        break;
                    case 'fcm_tokens':
                        data = await productionDataSource.getRepository(FcmToken).find();
                        break;
                    case 'departments':
                        data = await productionDataSource.getRepository(Department).find({ order: { order: 'ASC' } });
                        break;
                    case 'employees':
                        data = await productionDataSource.getRepository(Employee).find();
                        break;
                    case 'employee_department_positions':
                        data = await productionDataSource.getRepository(EmployeeDepartmentPosition).find();
                        break;
                    case 'employee_rank_histories':
                        data = await productionDataSource.getRepository(EmployeeRankHistory).find();
                        break;
                    case 'employee_tokens':
                        data = await productionDataSource.getRepository(EmployeeToken).find();
                        break;
                    case 'employee_fcm_tokens':
                        data = await productionDataSource.getRepository(EmployeeFcmToken).find();
                        break;
                    case 'employee_system_roles':
                        data = await productionDataSource.getRepository(EmployeeSystemRole).find();
                        break;
                    case 'department_history':
                        data = await productionDataSource.getRepository(DepartmentHistory).find();
                        break;
                    case 'employee_department_position_history':
                        data = await productionDataSource.getRepository(EmployeeDepartmentPositionHistory).find();
                        break;
                    default:
                        this.logger.warn(`⚠️  알 수 없는 테이블: ${table}`);
                }

                dataMap.set(table, data);
                this.logger.log(`  ✓ ${table}: ${data.length}개 데이터 조회`);
            } catch (error) {
                this.logger.error(`  ✗ ${table} 조회 실패:`, error);
                throw error;
            }
        }

        return dataMap;
    }

    /**
     * 개발서버 데이터 삭제 (의존성 역순)
     */
    private async deleteDataInReverseOrder(manager: any, tables: string[]): Promise<void> {
        // 삭제 순서: 의존성이 있는 것부터 (역순)
        const deleteOrder = [
            'employee_system_roles',
            'employee_fcm_tokens',
            'employee_tokens',
            'employee_department_position_history',
            'employee_rank_histories',
            'employee_department_positions',
            'employees',
            'department_history',
            'departments',
            'positions',
            'ranks',
            'fcm_tokens',
            'system_roles',
            'tokens',
            'systems',
        ];

        for (const table of deleteOrder) {
            if (tables.includes(table)) {
                try {
                    const result = await manager.query(`DELETE FROM "${table}"`);
                    this.logger.log(`  ✓ ${table} 삭제 완료 (${result[1] || 0}개)`);
                } catch (error) {
                    this.logger.error(`  ✗ ${table} 삭제 실패:`, error);
                    throw error;
                }
            }
        }
    }

    /**
     * 개발서버에 데이터 입력 (의존성 정순)
     */
    private async insertDataInCorrectOrder(manager: any, dataMap: Map<string, any[]>, tables: string[]): Promise<void> {
        // 입력 순서: 의존성이 없는 것부터 (정순)
        const insertOrder = [
            'systems',
            'tokens',
            'system_roles',
            'ranks',
            'positions',
            'fcm_tokens',
            'departments',
            'department_history',
            'employees',
            'employee_department_positions',
            'employee_rank_histories',
            'employee_department_position_history',
            'employee_tokens',
            'employee_fcm_tokens',
            'employee_system_roles',
        ];

        for (const table of insertOrder) {
            if (tables.includes(table) && dataMap.has(table)) {
                const data = dataMap.get(table) || [];

                if (data.length === 0) {
                    this.logger.log(`  ⊘ ${table}: 데이터 없음`);
                    continue;
                }

                try {
                    // 특별 처리가 필요한 테이블
                    if (table === 'departments') {
                        await this.insertDepartmentsHierarchically(manager, data);
                    } else {
                        await this.bulkInsertData(manager, table, data);
                    }

                    this.logger.log(`  ✓ ${table} 입력 완료 (${data.length}개)`);
                } catch (error) {
                    this.logger.error(`  ✗ ${table} 입력 실패:`, error);
                    throw error;
                }
            }
        }
    }

    /**
     * 부서 계층구조를 고려하여 입력
     */
    private async insertDepartmentsHierarchically(manager: any, departments: Department[]): Promise<void> {
        // 부서를 Map으로 변환
        const deptMap = new Map(departments.map((d) => [d.id, d]));
        const inserted = new Set<string>();

        // 재귀적으로 부서 삽입 (상위 부서부터)
        const insertDepartment = async (dept: Department): Promise<void> => {
            if (inserted.has(dept.id)) return;

            // 상위 부서가 있으면 먼저 삽입
            if (dept.parentDepartmentId && deptMap.has(dept.parentDepartmentId)) {
                const parent = deptMap.get(dept.parentDepartmentId)!;
                await insertDepartment(parent);
            }

            // 현재 부서 삽입
            await manager.getRepository(Department).save(dept);
            inserted.add(dept.id);
        };

        // 모든 부서 삽입
        for (const dept of departments) {
            await insertDepartment(dept);
        }
    }

    /**
     * 벌크 데이터 입력
     */
    private async bulkInsertData(manager: any, table: string, data: any[]): Promise<void> {
        const entityMap = {
            systems: System,
            system_roles: SystemRole,
            ranks: Rank,
            positions: Position,
            fcm_tokens: FcmToken,
            tokens: Token,
            employees: Employee,
            departments: Department,
            department_history: DepartmentHistory,
            employee_department_positions: EmployeeDepartmentPosition,
            employee_rank_histories: EmployeeRankHistory,
            employee_department_position_history: EmployeeDepartmentPositionHistory,
            employee_tokens: EmployeeToken,
            employee_fcm_tokens: EmployeeFcmToken,
            employee_system_roles: EmployeeSystemRole,
        };

        const entity = entityMap[table];
        if (!entity) {
            throw new Error(`Unknown table: ${table}`);
        }

        // 청크 단위로 나눠서 입력 (성능 최적화)
        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await manager.getRepository(entity).save(chunk);
        }
    }
}
