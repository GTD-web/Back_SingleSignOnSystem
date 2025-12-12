import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Employee } from '../../domain/employee/employee.entity';
import { EmployeeDepartmentPosition } from '../../domain/employee-department-position/employee-department-position.entity';
import { EmployeeDepartmentPositionHistory } from '../../domain/employee-department-position-history/employee-department-position-history.entity';
import { EmployeeStatus } from '../../../../libs/common/enums';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 퇴사자 데이터 타입
 */
export interface TerminatedEmployeeData {
    name: string;
    employeeNumber: string;
    expectedTerminationDate: string; // YYYY-MM-DD
}

/**
 * 마이그레이션 결과 타입
 */
export interface TerminatedEmployeeMigrationResult {
    employeeNumber: string;
    employeeName: string;
    success: boolean;
    error?: string;
    updates?: {
        terminationDateUpdated: boolean;
        terminatedDeptHistorySetCurrent: boolean;
        otherHistoriesUpdated: number;
        assignmentsDeleted: number;
    };
}

/**
 * 퇴사자 데이터 마이그레이션 서비스
 * 퇴사일 및 이력 데이터를 정리합니다
 */
@Injectable()
export class TerminatedEmployeeMigrationService {
    private readonly logger = new Logger(TerminatedEmployeeMigrationService.name);

    constructor(private readonly dataSource: DataSource) {}

    /**
     * 퇴사자 데이터 마이그레이션 실행
     * terminatedEmployees를 제공하지 않으면 JSON 파일에서 로드한 데이터 사용
     */
    async execute퇴사자데이터마이그레이션(): Promise<{
        success: boolean;
        totalProcessed: number;
        successCount: number;
        failedCount: number;
        results: TerminatedEmployeeMigrationResult[];
    }> {
        const filePath = path.join(__dirname, 'terminated-employees-data.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const terminatedEmployeesData = JSON.parse(fileContent);
        // terminatedEmployees가 제공되지 않으면 JSON 파일 데이터 사용
        const dataToProcess = terminatedEmployeesData;

        if (!dataToProcess || dataToProcess.length === 0) {
            throw new Error('처리할 퇴사자 데이터가 없습니다. JSON 파일을 확인하세요.');
        }

        this.logger.log('='.repeat(80));
        this.logger.log('퇴사자 데이터 마이그레이션 시작');
        this.logger.log(`처리 대상: ${dataToProcess.length}명`);
        this.logger.log('='.repeat(80));

        const results: TerminatedEmployeeMigrationResult[] = [];
        let successCount = 0;
        let failedCount = 0;

        for (const data of dataToProcess) {
            try {
                this.logger.log(`\n처리 중: ${data.name} (${data.employeeNumber})`);
                const result = await this.process퇴사자데이터(data);
                results.push(result);

                if (result.success) {
                    successCount++;
                    this.logger.log(`✅ 성공: ${data.name} (${data.employeeNumber})`);
                } else {
                    failedCount++;
                    this.logger.error(`❌ 실패: ${data.name} (${data.employeeNumber}) - ${result.error}`);
                }
            } catch (error) {
                failedCount++;
                this.logger.error(`❌ 예외 발생: ${data.name} (${data.employeeNumber})`, error.stack);
                results.push({
                    employeeNumber: data.employeeNumber,
                    employeeName: data.name,
                    success: false,
                    error: error.message,
                });
            }
        }

        this.logger.log('='.repeat(80));
        this.logger.log('퇴사자 데이터 마이그레이션 완료');
        this.logger.log(`총 처리: ${dataToProcess.length}명`);
        this.logger.log(`성공: ${successCount}명`);
        this.logger.log(`실패: ${failedCount}명`);
        this.logger.log('='.repeat(80));

        return {
            success: failedCount === 0,
            totalProcessed: dataToProcess.length,
            successCount,
            failedCount,
            results,
        };
    }

    /**
     * 개별 퇴사자 데이터 처리
     */
    private async process퇴사자데이터(data: TerminatedEmployeeData): Promise<TerminatedEmployeeMigrationResult> {
        const result: TerminatedEmployeeMigrationResult = {
            employeeNumber: data.employeeNumber,
            employeeName: data.name,
            success: false,
            updates: {
                terminationDateUpdated: false,
                terminatedDeptHistorySetCurrent: false,
                otherHistoriesUpdated: 0,
                assignmentsDeleted: 0,
            },
        };

        await this.dataSource.transaction(async (manager) => {
            // 1. 직원 조회
            const employee = await manager.findOne(Employee, {
                where: { employeeNumber: data.employeeNumber },
            });

            if (!employee) {
                throw new Error(`사번 ${data.employeeNumber}에 해당하는 직원을 찾을 수 없습니다.`);
            }

            // 2. 퇴사 상태 확인
            if (employee.status !== EmployeeStatus.Terminated) {
                throw new Error(`직원이 퇴사 상태가 아닙니다. 현재 상태: ${employee.status}`);
            }

            this.logger.debug(`  - 직원 조회 완료: ${employee.name} (${employee.id})`);

            // 3. 퇴사자 부서 조회
            const terminatedDept = await manager.query(
                `SELECT id FROM departments WHERE "isException" = true AND ("departmentName" = '퇴사자' OR "departmentCode" = '퇴사자') LIMIT 1`,
            );

            if (!terminatedDept || terminatedDept.length === 0) {
                throw new Error('퇴사자 부서를 찾을 수 없습니다.');
            }

            const terminatedDeptId = terminatedDept[0].id;
            this.logger.debug(`  - 퇴사자 부서 ID: ${terminatedDeptId}`);

            // 4. 직원의 퇴사일 업데이트
            await manager.update(Employee, { id: employee.id }, { terminationDate: data.expectedTerminationDate });
            result.updates.terminationDateUpdated = true;
            this.logger.debug(`  - 퇴사일 업데이트: ${data.expectedTerminationDate}`);

            // 5. 퇴사자 부서 이력을 isCurrent = true로 설정
            const terminatedHistoryUpdateResult = await manager.update(
                EmployeeDepartmentPositionHistory,
                {
                    employeeId: employee.id,
                    departmentId: terminatedDeptId,
                },
                {
                    isCurrent: true,
                    effectiveStartDate: data.expectedTerminationDate,
                    effectiveEndDate: null,
                },
            );

            if (terminatedHistoryUpdateResult.affected > 0) {
                result.updates.terminatedDeptHistorySetCurrent = true;
                this.logger.debug(`  - 퇴사자 부서 이력 업데이트: ${terminatedHistoryUpdateResult.affected}건`);
            } else {
                this.logger.warn(`  ⚠️  퇴사자 부서 이력을 찾을 수 없습니다.`);
            }

            // 6. 다른 부서 이력들을 isCurrent = false로 설정하고 유효기간 설정 (입사일 ~ 퇴사일)
            const otherHistoriesUpdateResult = await manager
                .createQueryBuilder()
                .update(EmployeeDepartmentPositionHistory)
                .set({
                    isCurrent: false,
                    effectiveStartDate: employee.hireDate,
                    effectiveEndDate: data.expectedTerminationDate,
                })
                .where('employeeId = :employeeId', { employeeId: employee.id })
                .andWhere('departmentId != :terminatedDeptId', { terminatedDeptId })
                .andWhere('isCurrent = :isCurrent', { isCurrent: true })
                .execute();

            result.updates.otherHistoriesUpdated = otherHistoriesUpdateResult.affected || 0;
            this.logger.debug(`  - 다른 부서 이력 종료 처리: ${result.updates.otherHistoriesUpdated}건`);

            // 7. 배치 데이터에서 퇴사자 부서가 아닌 배치 삭제
            const assignmentsDeleteResult = await manager
                .createQueryBuilder()
                .delete()
                .from(EmployeeDepartmentPosition)
                .where('employeeId = :employeeId', { employeeId: employee.id })
                .andWhere('departmentId != :terminatedDeptId', { terminatedDeptId })
                .execute();

            result.updates.assignmentsDeleted = assignmentsDeleteResult.affected || 0;
            this.logger.debug(`  - 퇴사자 부서가 아닌 배치 삭제: ${result.updates.assignmentsDeleted}건`);

            result.success = true;
        });

        return result;
    }

    /**
     * CSV 형식의 문자열을 파싱하여 퇴사자 데이터 배열로 변환
     * 형식: "이름,사번,퇴사일" (한 줄에 하나씩)
     */
    parse퇴사자데이터FromCSV(csvData: string): TerminatedEmployeeData[] {
        const lines = csvData.trim().split('\n');
        const result: TerminatedEmployeeData[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',').map((p) => p.trim());
            if (parts.length < 3) {
                this.logger.warn(`⚠️  라인 ${i + 1} 스킵: 형식 오류 - ${line}`);
                continue;
            }

            result.push({
                name: parts[0],
                employeeNumber: parts[1],
                expectedTerminationDate: parts[2],
            });
        }

        this.logger.log(`CSV 파싱 완료: ${result.length}건`);
        return result;
    }

    /**
     * JSON 배열을 퇴사자 데이터로 변환
     */
    parse퇴사자데이터FromJSON(
        jsonData: Array<{ name: string; employeeNumber: string; expectedTerminationDate: string }>,
    ): TerminatedEmployeeData[] {
        this.logger.log(`JSON 파싱 완료: ${jsonData.length}건`);
        return jsonData.map((item) => ({
            name: item.name,
            employeeNumber: item.employeeNumber,
            expectedTerminationDate: item.expectedTerminationDate,
        }));
    }

    /**
     * 퇴사 상태인 직원들의 현재 상태 조회
     */
    async get퇴사자현황(): Promise<
        Array<{
            employeeId: string;
            employeeNumber: string;
            employeeName: string;
            terminationDate: string | null;
            currentDepartment: string;
            currentDepartmentId: string;
            hasMultipleAssignments: boolean;
            historyCount: number;
        }>
    > {
        const result = await this.dataSource.query(
            `
            SELECT 
                e.id as "employeeId",
                e."employeeNumber",
                e.name as "employeeName",
                e."terminationDate",
                d."departmentName" as "currentDepartment",
                d.id as "currentDepartmentId",
                d."isException" as "isDepartmentException",
                COUNT(DISTINCT edp.id) as "assignmentCount",
                COUNT(DISTINCT h."historyId") as "historyCount"
            FROM employees e
            LEFT JOIN employee_department_positions edp ON e.id = edp."employeeId"
            LEFT JOIN departments d ON edp."departmentId" = d.id
            LEFT JOIN employee_department_position_history h ON e.id = h."employeeId" AND h."isCurrent" = true
            WHERE e.status = '퇴사'
            GROUP BY e.id, e."employeeNumber", e.name, e."terminationDate", d."departmentName", d.id, d."isException"
            ORDER BY e."employeeNumber"
            `,
        );

        return result.map((row) => ({
            employeeId: row.employeeId,
            employeeNumber: row.employeeNumber,
            employeeName: row.employeeName,
            terminationDate: row.terminationDate,
            currentDepartment: row.currentDepartment,
            currentDepartmentId: row.currentDepartmentId,
            hasMultipleAssignments: parseInt(row.assignmentCount) > 1,
            historyCount: parseInt(row.historyCount),
        }));
    }
}
