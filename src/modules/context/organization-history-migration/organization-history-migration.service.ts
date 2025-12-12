import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmployeeDepartmentPositionHistory } from '../../domain/employee-department-position-history/employee-department-position-history.entity';
import { Employee } from '../../domain/employee/employee.entity';
import { November2025LoaderHelper } from './november-2025-loader.helper';

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
    ) {}

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
     * 12월 현재 이력 데이터를 로드합니다
     */
    async load12월현재이력데이터(): Promise<December2025OrgData[]> {
        this.logger.log('12월 현재 이력 데이터 로드 시작');

        const currentHistories = await this.dataSource
            .getRepository(EmployeeDepartmentPositionHistory)
            .createQueryBuilder('history')
            .leftJoinAndSelect('history.employee', 'employee')
            .where('history.isCurrent = :isCurrent', { isCurrent: true })
            .getMany();

        const december2025Data: December2025OrgData[] = currentHistories.map((history) => ({
            historyId: history.historyId,
            employeeId: history.employeeId,
            departmentId: history.departmentId,
            positionId: history.positionId,
            rankId: history.rankId,
            isManager: history.isManager,
            effectiveStartDate: history.effectiveStartDate,
            hireDate: history.employee?.hireDate,
        }));

        this.logger.log(`12월 현재 이력 데이터 ${december2025Data.length}건 로드 완료`);
        return december2025Data;
    }

    /**
     * 11월과 12월 조직도를 비교합니다
     * departmentId와 positionId만 비교하여 변경 여부를 판단합니다
     */
    compare조직도데이터(november: November2025OrgData[], december: December2025OrgData[]): ComparisonResult[] {
        this.logger.log('11월-12월 조직도 비교 시작 (부서, 직책 기준)');

        const decemberMap = new Map(december.map((d) => [d.employeeId, d]));
        const results: ComparisonResult[] = [];

        for (const novData of november) {
            const decData = decemberMap.get(novData.employeeId);

            if (!decData) {
                this.logger.warn(
                    `12월 현재 이력에서 직원을 찾을 수 없음: ${novData.employeeName} (${novData.employeeNumber})`,
                );
                continue;
            }

            // 부서 또는 직책이 변경되었는지 확인 (departmentId, positionId만 비교)
            const hasChanged =
                novData.departmentId !== decData.departmentId || novData.positionId !== decData.positionId;

            if (hasChanged) {
                this.logger.debug(
                    `변경 감지: ${novData.employeeName} (${novData.employeeNumber}) - ` +
                        `${novData.departmentName}/${novData.positionTitle} → 12월 조직개편`,
                );
            }

            results.push({
                employeeId: novData.employeeId,
                hasChanged,
                november: novData,
                december: decData,
            });
        }

        const changedCount = results.filter((r) => r.hasChanged).length;
        this.logger.log(`비교 완료: 전체 ${results.length}건 중 부서/직책 변경 ${changedCount}건`);

        return results;
    }

    /**
     * 변경된 직원들의 11월 이력을 생성하고 12월 이력을 수정합니다
     * 부서 또는 직책이 변경된 직원만 처리합니다
     */
    async apply이력변경사항(comparisons: ComparisonResult[]): Promise<{
        createdCount: number;
        updatedCount: number;
        errors: Array<{ employeeId: string; employeeName: string; error: string }>;
    }> {
        this.logger.log('이력 변경사항 적용 시작');

        let createdCount = 0;
        let updatedCount = 0;
        const errors: Array<{ employeeId: string; employeeName: string; error: string }> = [];

        // 변경된 직원들만 필터링 (부서 또는 직책이 변경된 경우)
        const changedEmployees = comparisons.filter((c) => c.hasChanged);
        this.logger.log(`부서/직책 변경된 직원 ${changedEmployees.length}건 처리 시작`);

        await this.dataSource.transaction(async (manager) => {
            for (const comparison of changedEmployees) {
                try {
                    const { employeeId, november, december } = comparison;

                    // 1. 11월 이력 생성 (입사일 ~ 2025-11-30)
                    const november30 = '2025-11-30';
                    const effectiveStartDate = december.hireDate
                        ? this.formatDate(december.hireDate)
                        : december.effectiveStartDate;

                    const novemberHistory = manager.create(EmployeeDepartmentPositionHistory, {
                        employeeId: employeeId,
                        departmentId: november.departmentId,
                        positionId: november.positionId,
                        rankId: november.rankId,
                        isManager: november.isManager,
                        effectiveStartDate: effectiveStartDate,
                        effectiveEndDate: november30,
                        isCurrent: false,
                        assignmentReason: `2025년 11월 조직도 (${november.departmentName}/${november.positionTitle})`,
                    });

                    await manager.save(EmployeeDepartmentPositionHistory, novemberHistory);
                    createdCount++;

                    this.logger.debug(
                        `11월 이력 생성: ${november.employeeName} (${november.employeeNumber}) - ` +
                            `${november.departmentName}/${november.positionTitle} (${effectiveStartDate} ~ ${november30})`,
                    );

                    // 2. 12월 이력 수정 (effectiveStartDate를 2025-12-01로 변경)
                    // 단, 12월 1일 이후 입사자는 입사일 그대로 유지
                    const december1st = '2025-12-01';
                    const currentStartDate = this.formatDate(december.effectiveStartDate);
                    const newStartDate = currentStartDate < december1st ? december1st : currentStartDate;

                    await manager.update(
                        EmployeeDepartmentPositionHistory,
                        { historyId: december.historyId },
                        {
                            effectiveStartDate: newStartDate,
                            assignmentReason: '2025년 12월 조직개편',
                        },
                    );
                    updatedCount++;

                    const dateChangeInfo =
                        newStartDate !== currentStartDate
                            ? `시작일을 ${currentStartDate} → ${newStartDate}로 변경`
                            : `시작일 유지 (${currentStartDate}, 12월 1일 이후 입사자)`;

                    this.logger.debug(
                        `12월 이력 수정: ${november.employeeName} (${november.employeeNumber}) - ${dateChangeInfo}`,
                    );
                } catch (error) {
                    this.logger.error(
                        `❌ 이력 처리 실패: ${comparison.november.employeeName} (${comparison.november.employeeNumber})`,
                        error.stack,
                    );
                    errors.push({
                        employeeId: comparison.employeeId,
                        employeeName: comparison.november.employeeName,
                        error: error.message,
                    });
                }
            }
        });

        this.logger.log(
            `이력 변경사항 적용 완료: 생성 ${createdCount}건, 수정 ${updatedCount}건, 실패 ${errors.length}건`,
        );

        if (errors.length > 0) {
            this.logger.error('실패 목록:');
            errors.forEach((err) => this.logger.error(`   - ${err.employeeName}: ${err.error}`));
        }

        return { createdCount, updatedCount, errors };
    }

    /**
     * 11월 조직도 이력 마이그레이션 전체 프로세스 실행
     */
    /**
     * 11월 조직도 이력 마이그레이션 전체 프로세스 실행
     */
    async execute11월조직도이력마이그레이션(): Promise<{
        success: boolean;
        totalProcessed: number;
        changedCount: number;
        unchangedCount: number;
        createdCount: number;
        updatedCount: number;
        errors: Array<{ employeeId: string; employeeName: string; error: string }>;
    }> {
        this.logger.log('='.repeat(80));
        this.logger.log('11월 조직도 이력 마이그레이션 시작');
        this.logger.log('='.repeat(80));

        try {
            // 1단계: 11월 조직도 데이터 로드
            const november = await this.load11월조직도데이터();
            this.logger.log(`✅ 1단계: 11월 조직도 데이터 ${november.length}건 로드 완료`);

            // 2단계: 12월 현재 이력 데이터 로드
            const december = await this.load12월현재이력데이터();
            this.logger.log(`✅ 2단계: 12월 현재 이력 데이터 ${december.length}건 로드 완료`);

            // 3단계: 비교 (부서, 직책만 비교)
            const comparisons = this.compare조직도데이터(november, december);
            const changedCount = comparisons.filter((c) => c.hasChanged).length;
            const unchangedCount = comparisons.length - changedCount;
            this.logger.log(`✅ 3단계: 비교 완료`);

            // 4단계: 변경사항 적용
            const result = await this.apply이력변경사항(comparisons);
            this.logger.log(`✅ 4단계: 이력 변경사항 적용 완료`);

            this.logger.log('='.repeat(80));
            this.logger.log('📊 11월 조직도 이력 마이그레이션 완료');
            this.logger.log('='.repeat(80));
            this.logger.log(`총 처리 직원: ${comparisons.length}명`);
            this.logger.log(`  ├─ 부서/직책 변경: ${changedCount}명 ✅`);
            this.logger.log(`  └─ 변경 없음: ${unchangedCount}명 (이력 생성 안 함)`);
            this.logger.log('');
            this.logger.log(`이력 생성: ${result.createdCount}건 (11월 이력)`);
            this.logger.log(`이력 수정: ${result.updatedCount}건 (12월 이력 시작일 변경)`);
            this.logger.log(`처리 실패: ${result.errors.length}건`);
            this.logger.log('='.repeat(80));

            return {
                success: result.errors.length === 0,
                totalProcessed: comparisons.length,
                changedCount,
                unchangedCount,
                createdCount: result.createdCount,
                updatedCount: result.updatedCount,
                errors: result.errors,
            };
        } catch (error) {
            this.logger.error('❌ 11월 조직도 이력 마이그레이션 실패', error.stack);
            throw error;
        }
    }

    /**
     * Date를 YYYY-MM-DD 형식으로 변환
     */
    private formatDate(date: Date | string): string {
        if (typeof date === 'string') return date;
        return date.toISOString().split('T')[0];
    }

    /**
     * 11월 조직도 데이터를 CSV/Excel에서 로드하는 헬퍼
     */
    async load11월조직도From파일(filePath: string): Promise<November2025OrgData[]> {
        // TODO: CSV/Excel 파일 파싱 로직 구현
        this.logger.log(`11월 조직도 파일 로드: ${filePath}`);
        throw new Error('파일 로드 기능은 아직 구현되지 않았습니다.');
    }

    /**
     * 직원 이름으로 ID 찾기 (매핑용)
     */
    async find직원IDByName(name: string): Promise<string | null> {
        const employee = await this.dataSource.getRepository(Employee).findOne({
            where: { name },
        });
        return employee?.id || null;
    }

    /**
     * 부서 이름으로 ID 찾기 (매핑용)
     */
    async find부서IDByName(departmentName: string): Promise<string | null> {
        const result = await this.dataSource.query(`SELECT id FROM departments WHERE "departmentName" = $1 LIMIT 1`, [
            departmentName,
        ]);
        return result[0]?.id || null;
    }
}
