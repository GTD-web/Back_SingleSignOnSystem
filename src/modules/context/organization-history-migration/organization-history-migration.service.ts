import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmployeeDepartmentPositionHistory } from '../../domain/employee-department-position-history/employee-department-position-history.entity';
import { Employee } from '../../domain/employee/employee.entity';
import { November2025LoaderHelper } from './november-2025-loader.helper';
import { AssignmentManagementContextService } from '../organization-management/assignment-management-context.service';

/**
 * 11월 조직도 데이터 타입
 */
interface November2025OrgData {
    employeeId: string;
    employeeNumber: string;
    employeeName: string;
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    parentDepartmentId: string | null;
    positionId: string;
    positionTitle: string;
    positionCode: string;
    rankId: string | null;
    rankName: string | null;
    rankCode: string | null;
    isManager: boolean;
}

/**
 * 12월 조직도 데이터 타입 (현재 이력)
 */
interface December2025OrgData {
    historyId: string;
    employeeId: string;
    departmentId: string;
    parentDepartmentId: string | null;
    positionId: string;
    rankId: string | null;
    isManager: boolean;
    effectiveStartDate: string;
    hireDate: Date;
}

/**
 * 비교 결과 타입
 */
interface ComparisonResult {
    employeeId: string;
    hasChanged: boolean;
    november: November2025OrgData;
    december: December2025OrgData;
}

/**
 * 조직도 이력 마이그레이션 서비스
 * 11월과 12월 조직도 비교 후 이력 생성
 */
@Injectable()
export class OrganizationHistoryMigrationService {
    private readonly logger = new Logger(OrganizationHistoryMigrationService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly november2025Loader: November2025LoaderHelper,
        private readonly assignmentContext: AssignmentManagementContextService,
    ) {}

    // async onApplicationBootstrap() {
    //     console.log(await this.load11월이력데이터());
    // }

    /**
     * 11월 조직도 데이터를 로드합니다
     */
    async load11월조직도데이터(): Promise<November2025OrgData[]> {
        this.logger.log('11월 조직도 데이터 로드 시작');

        // JSON 파일에서 로드
        const november2025Data = await this.november2025Loader.loadFromJson();

        this.logger.log(`11월 조직도 데이터 ${november2025Data.length}건 로드 완료`);
        return november2025Data;
    }

    /**
     * 통합 마이그레이션 실행
     * 1. 기존 이력 삭제 (초기 데이터 마이그레이션 제외)
     * 2. 11월 조직도 마이그레이션
     * 3. 12월 조직도 마이그레이션
     */
    async execute통합마이그레이션() {
        const startTime = Date.now();
        this.logger.log('='.repeat(80));
        this.logger.log('📋 통합 마이그레이션 시작');
        this.logger.log('='.repeat(80));

        let deletedHistories = 0;
        let november = { totalEmployees: 0, created: 0, skipped: 0, errors: [] };
        let december = { totalEmployees: 0, created: 0, skipped: 0, errors: [] };

        try {
            // ========================================
            // STEP 1: 기존 이력 삭제 (초기 데이터 마이그레이션 제외)
            // ========================================
            this.logger.log('');
            this.logger.log('='.repeat(80));
            this.logger.log('🗑️  STEP 1: 기존 이력 삭제');
            this.logger.log('='.repeat(80));

            const deleteResult = await this.dataSource.query(
                `
                DELETE FROM employee_department_position_history
                WHERE "assignmentReason" != '초기 데이터 마이그레이션'
                OR "assignmentReason" IS NULL
                `,
            );

            deletedHistories = deleteResult[1] || 0;
            this.logger.log(`✅ ${deletedHistories}건의 이력 삭제 완료 (초기 데이터 마이그레이션 데이터는 유지)`);

            // 삭제 후 이력이 한 개만 남은 직원의 이력을 현재 이력으로 설정
            const updateResult = await this.dataSource.query(
                `
                UPDATE employee_department_position_history
                SET "effectiveEndDate" = NULL, "isCurrent" = true
                WHERE "historyId" IN (
                    SELECT "historyId"
                    FROM employee_department_position_history
                    WHERE "employeeId" IN (
                        SELECT "employeeId"
                        FROM employee_department_position_history
                        GROUP BY "employeeId"
                        HAVING COUNT(*) = 1
                    )
                )
                `,
            );

            const updatedHistories = updateResult[1] || 0;
            if (updatedHistories > 0) {
                this.logger.log(
                    `✅ 초기 데이터 단일 이력 업데이트: ${updatedHistories}건 (effectiveEndDate: NULL, isCurrent: true)`,
                );
            }

            // ========================================
            // STEP 2: 11월 조직도 마이그레이션
            // ========================================
            this.logger.log('');
            this.logger.log('='.repeat(80));
            this.logger.log('📅 STEP 2: 11월 조직도 마이그레이션');
            this.logger.log('='.repeat(80));

            november = await this.migrate11월조직도();

            // ========================================
            // STEP 3: 12월 조직도 마이그레이션
            // ========================================
            this.logger.log('');
            this.logger.log('='.repeat(80));
            this.logger.log('📅 STEP 3: 12월 조직도 마이그레이션');
            this.logger.log('='.repeat(80));

            december = await this.migrate12월조직도();

            // ========================================
            // 완료
            // ========================================
            const endTime = Date.now();
            const executionTime = ((endTime - startTime) / 1000).toFixed(1);

            this.logger.log('');
            this.logger.log('='.repeat(80));
            this.logger.log('✅ 통합 마이그레이션 완료');
            this.logger.log('='.repeat(80));
            this.logger.log(`삭제된 이력: ${deletedHistories}건 (초기 데이터 마이그레이션 제외)`);
            this.logger.log(
                `11월 마이그레이션: ${november.created}/${november.totalEmployees}건 생성 (스킵: ${november.skipped}건, 실패: ${november.errors.length}건)`,
            );
            this.logger.log(
                `12월 마이그레이션: ${december.created}/${december.totalEmployees}건 생성 (스킵: ${december.skipped}건, 실패: ${december.errors.length}건)`,
            );
            this.logger.log(`실행 시간: ${executionTime}초`);
            this.logger.log('='.repeat(80));

            return {
                success: november.errors.length === 0 && december.errors.length === 0,
                deletedHistories,
                november,
                december,
                executionTime: `${executionTime}초`,
            };
        } catch (error) {
            this.logger.error('❌ 통합 마이그레이션 실패', error.stack);
            throw error;
        }
    }

    /**
     * 11월 조직도 마이그레이션
     */
    private async migrate11월조직도() {
        const november2025Data = await this.load11월조직도데이터();
        this.logger.log(`11월 조직도 데이터 ${november2025Data.length}건 로드 완료`);

        let created = 0;
        let skipped = 0;
        const errors = [];

        for (const data of november2025Data) {
            try {
                // 1. 직원의 입사일 조회
                const employee = await this.dataSource
                    .getRepository(Employee)
                    .findOne({ where: { id: data.employeeId } });

                if (!employee) {
                    throw new Error(`직원 정보를 찾을 수 없습니다: ${data.employeeName}`);
                }

                // 2. 초기 마이그레이션 데이터 조회
                const initialHistory = await this.dataSource.query(
                    `
                    SELECT 
                        "historyId",
                        "departmentId",
                        "parentDepartmentId",
                        "positionId",
                        "isManager",
                        "effectiveStartDate",
                        "isCurrent"
                    FROM employee_department_position_history
                    WHERE "employeeId" = $1
                    AND "assignmentReason" = '초기 데이터 마이그레이션'
                    LIMIT 1
                    `,
                    [data.employeeId],
                );

                // 3. 초기 데이터와 11월 데이터 비교
                if (initialHistory && initialHistory.length > 0) {
                    const initial = initialHistory[0];
                    const isMatch =
                        initial.departmentId === data.departmentId &&
                        initial.positionId === data.positionId &&
                        initial.isManager === data.isManager;

                    if (isMatch) {
                        // 일치하면 그대로 유지, 이력 생성하지 않음
                        skipped++;
                        this.logger.debug(`  ⊘ ${data.employeeName}: 초기 데이터와 일치 (그대로 유지)`);
                        continue;
                    }
                }

                // 4. 11월 이력 생성 (초기 데이터가 없거나 불일치한 경우)
                // - 이전 이력 종료는 직원의_배치이력을_생성한다 함수에서 자동 처리
                // - 11월 이력 종료는 12월 마이그레이션에서 자동 처리
                const effectiveStartDate = new Date(employee.hireDate);

                await this.assignmentContext.직원의_배치이력을_생성한다({
                    employeeId: data.employeeId,
                    departmentId: data.departmentId,
                    parentDepartmentId: data.parentDepartmentId,
                    positionId: data.positionId,
                    isManager: data.isManager,
                    effectiveDate: effectiveStartDate,
                    assignmentReason: `2025년 11월 조직도 (${data.departmentName}/${data.positionTitle})`,
                    assignedBy: undefined,
                });

                created++;
                this.logger.debug(`  ✓ ${data.employeeName} (${data.departmentName}/${data.positionTitle})`);
            } catch (error) {
                this.logger.error(`  ✗ ${data.employeeName}: ${error.message}`);
                errors.push({
                    employeeId: data.employeeId,
                    employeeName: data.employeeName,
                    error: error.message,
                });
            }
        }

        this.logger.log(
            `11월 마이그레이션 완료: ${created}/${november2025Data.length}건 생성 (스킵: ${skipped}건 - 초기 데이터와 일치)`,
        );

        return {
            totalEmployees: november2025Data.length,
            created,
            skipped,
            errors,
        };
    }

    /**
     * 12월 조직도 마이그레이션
     * 11월 조직도와 비교하여 변경이 있는 경우에만 이력 생성
     */
    private async migrate12월조직도() {
        // 1. 11월 조직도 데이터 로드
        const november2025Data = await this.load11월조직도데이터();
        const november2025Map = new Map(november2025Data.map((data) => [data.employeeId, data]));

        this.logger.log(`11월 조직도 데이터 ${november2025Data.length}건 로드 완료`);

        // 2. 12월 현재 배치 데이터 조회 (부모 부서 포함)
        const currentAssignments = await this.dataSource.query(`
            SELECT 
                edp."employeeId",
                e."name" as "employeeName",
                e."employeeNumber",
                edp."departmentId",
                d."departmentName",
                d."parentDepartmentId",
                edp."positionId",
                p."positionTitle",
                edp."isManager"
            FROM employee_department_positions edp
            INNER JOIN employees e ON e.id = edp."employeeId"
            INNER JOIN departments d ON d.id = edp."departmentId"
            INNER JOIN positions p ON p.id = edp."positionId"
            WHERE e.status = '재직중'
        `);

        this.logger.log(`12월 현재 배치 데이터 ${currentAssignments.length}건 로드 완료`);

        let created = 0;
        let skipped = 0;
        const errors = [];
        const changes = [];

        for (const assignment of currentAssignments) {
            try {
                // 11월 데이터 조회
                const november2025 = november2025Map.get(assignment.employeeId);

                // 11월 데이터가 없는 경우 (12월 신규 입사자)
                if (!november2025) {
                    // 직원의 입사일 조회
                    const employee = await this.dataSource
                        .getRepository(Employee)
                        .findOne({ where: { id: assignment.employeeId } });

                    if (!employee) {
                        throw new Error(`직원 정보를 찾을 수 없습니다: ${assignment.employeeName}`);
                    }

                    const hireDate = new Date(employee.hireDate);
                    const december1st = new Date('2025-12-01');

                    // 12월 이후 입사자만 이력 생성
                    if (hireDate >= december1st) {
                        await this.assignmentContext.직원의_배치이력을_생성한다({
                            employeeId: assignment.employeeId,
                            departmentId: assignment.departmentId,
                            parentDepartmentId: assignment.parentDepartmentId,
                            positionId: assignment.positionId,
                            isManager: assignment.isManager,
                            effectiveDate: december1st,
                            assignmentReason: '2025년 12월 조직도 (신규 입사)',
                            assignedBy: undefined,
                        });

                        created++;
                        this.logger.debug(`  ✨ ${assignment.employeeName} (신규 입사)`);
                    }
                    continue;
                }

                // 3. 11월과 12월 비교 - 변경사항 확인
                const changedFields = [];

                if (assignment.departmentId !== november2025.departmentId) {
                    changedFields.push(`부서 변경 (${november2025.departmentName} → ${assignment.departmentName})`);
                }

                if (assignment.parentDepartmentId !== november2025.parentDepartmentId) {
                    changedFields.push('상위부서 변경');
                }

                if (assignment.positionId !== november2025.positionId) {
                    changedFields.push(`직책 변경 (${november2025.positionTitle} → ${assignment.positionTitle})`);
                }

                if (assignment.isManager !== november2025.isManager) {
                    changedFields.push(`관리자권한 변경 (${november2025.isManager} → ${assignment.isManager})`);
                }

                // 4. 변경이 있는 경우에만 12월 이력 생성
                if (changedFields.length > 0) {
                    const employee = await this.dataSource
                        .getRepository(Employee)
                        .findOne({ where: { id: assignment.employeeId } });

                    if (!employee) {
                        throw new Error(`직원 정보를 찾을 수 없습니다: ${assignment.employeeName}`);
                    }

                    const hireDate = new Date(employee.hireDate);
                    const december1st = new Date('2025-12-01'); // 입사일이 12월 1일 이후면 입사일 사용, 아니면 12월 1일 사용
                    const effectiveStartDate = hireDate >= december1st ? hireDate : december1st;

                    // 배치이력 생성 (실제 로직 사용)
                    await this.assignmentContext.직원의_배치이력을_생성한다({
                        employeeId: assignment.employeeId,
                        departmentId: assignment.departmentId,
                        parentDepartmentId: assignment.parentDepartmentId,
                        positionId: assignment.positionId,
                        isManager: assignment.isManager,
                        effectiveDate: effectiveStartDate,
                        assignmentReason: `2025년 12월 조직도 (${changedFields.join(', ')})`,
                        assignedBy: undefined,
                    });

                    created++;
                    changes.push({
                        employeeName: assignment.employeeName,
                        employeeNumber: assignment.employeeNumber,
                        changes: changedFields,
                    });
                    this.logger.debug(`  ✓ ${assignment.employeeName}: ${changedFields.join(', ')}`);
                } else {
                    // 변경 없음 - 스킵
                    skipped++;
                    this.logger.debug(`  ⊘ ${assignment.employeeName}: 변경 없음`);
                }
            } catch (error) {
                this.logger.error(`  ✗ ${assignment.employeeName}: ${error.message}`);
                errors.push({
                    employeeId: assignment.employeeId,
                    employeeName: assignment.employeeName,
                    error: error.message,
                });
            }
        }

        this.logger.log(`12월 마이그레이션 완료: ${created}/${currentAssignments.length}건 생성 (스킵: ${skipped}건)`);

        if (changes.length > 0) {
            this.logger.log('변경된 직원 목록:');
            changes.forEach((change) => {
                this.logger.log(`  - ${change.employeeName}(${change.employeeNumber}): ${change.changes.join(', ')}`);
            });
        }

        return {
            totalEmployees: currentAssignments.length,
            created,
            skipped,
            errors,
        };
    }
}
