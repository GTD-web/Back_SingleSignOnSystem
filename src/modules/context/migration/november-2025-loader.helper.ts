import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 11월 조직도 JSON 로더 헬퍼
 */
@Injectable()
export class November2025LoaderHelper {
    private readonly logger = new Logger(November2025LoaderHelper.name);

    constructor(private readonly dataSource: DataSource) {}

    /**
     * JSON 파일에서 11월 조직도 데이터 로드
     */
    async loadFromJson(): Promise<
        Array<{
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
        }>
    > {
        this.logger.log('JSON 파일에서 11월 조직도 데이터 로드 시작');

        // JSON 파일 읽기
        const jsonPath = path.join('src/modules/context/migration', 'november-2025-org-data.json');
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        const orgData = JSON.parse(jsonContent);

        const result: Array<{
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
        }> = [];

        // 재귀적으로 조직도 처리
        await this.processDepartmentRecursive(orgData.organization, result);

        this.logger.log(`JSON 파일에서 ${result.length}건의 데이터 로드 완료`);
        return result;
    }

    /**
     * 재귀적으로 부서와 직원 처리
     */
    private async processDepartmentRecursive(
        department: any,
        result: Array<{
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
        }>,
    ): Promise<void> {
        const departmentName = department.departmentName;

        // 부서 정보 찾기 (ID, 코드 포함)
        const departmentInfo = await this.findDepartmentInfoByName(departmentName);
        if (!departmentInfo) {
            this.logger.warn(`⚠️  부서를 찾을 수 없음: ${departmentName}`);
            this.logger.warn(`   → DB에 정확히 "${departmentName}" 이름으로 존재하는지 확인 필요`);
        }

        // 해당 부서의 직원들 처리
        if (department.employees && Array.isArray(department.employees)) {
            for (const employee of department.employees) {
                // 직원 정보 찾기 (ID, 사번 포함)
                const employeeBasicInfo = await this.findEmployeeInfoByName(employee.name);
                if (!employeeBasicInfo) {
                    this.logger.warn(
                        `⚠️  직원을 찾을 수 없음: ${employee.name} (부서: ${departmentName})${
                            employee.note ? ` [${employee.note}]` : ''
                        }`,
                    );
                    continue;
                }

                // 부서 정보가 없으면 스킵
                if (!departmentInfo) {
                    this.logger.warn(`   → 스킵: ${employee.name} (부서 정보 없음)`);
                    continue;
                }

                // 직원의 11월 당시 직책, 직급 정보 가져오기
                // 주의: 현재 DB의 배치정보에서 가져오므로 12월 이후 변경된 경우 다를 수 있음
                const employeeDetailInfo = await this.getEmployeeDetailInfo(employeeBasicInfo.id);

                if (!employeeDetailInfo.position) {
                    this.logger.warn(`⚠️  직책 정보 없음: ${employee.name} (부서: ${departmentName}) - 기본 직책 필요`);
                    continue;
                }

                result.push({
                    employeeId: employeeBasicInfo.id,
                    employeeNumber: employeeBasicInfo.employeeNumber,
                    employeeName: employee.name,
                    departmentId: departmentInfo.id,
                    departmentName: departmentInfo.name,
                    departmentCode: departmentInfo.code,
                    positionId: employeeDetailInfo.position.id,
                    positionTitle: employeeDetailInfo.position.title,
                    positionCode: employeeDetailInfo.position.code,
                    rankId: employeeDetailInfo.rank?.id || null,
                    rankName: employeeDetailInfo.rank?.name || null,
                    rankCode: employeeDetailInfo.rank?.code || null,
                    isManager: employee.isManager,
                });
            }
        }

        // 자식 부서들 재귀 처리
        if (department.children && Array.isArray(department.children)) {
            for (const childDept of department.children) {
                await this.processDepartmentRecursive(childDept, result);
            }
        }
    }

    /**
     * 직원 이름으로 기본 정보 찾기 (ID, 사번)
     */
    private async findEmployeeInfoByName(name: string): Promise<{ id: string; employeeNumber: string } | null> {
        const result = await this.dataSource.query(
            `SELECT id, "employeeNumber" FROM employees WHERE name = $1 LIMIT 1`,
            [name],
        );
        return result[0] || null;
    }

    /**
     * 부서 이름으로 상세 정보 찾기 (ID, 이름, 코드)
     */
    private async findDepartmentInfoByName(
        departmentName: string,
    ): Promise<{ id: string; name: string; code: string } | null> {
        const result = await this.dataSource.query(
            `SELECT id, "departmentName" as name, "departmentCode" as code FROM departments WHERE "departmentName" = $1 LIMIT 1`,
            [departmentName],
        );
        return result[0] || null;
    }

    /**
     * 직원의 현재 직책, 직급 상세 정보 가져오기
     */
    private async getEmployeeDetailInfo(employeeId: string): Promise<{
        position: { id: string; title: string; code: string } | null;
        rank: { id: string; name: string; code: string } | null;
    }> {
        // 현재 배치 정보에서 직책 정보 가져오기
        const assignmentResult = await this.dataSource.query(
            `
            SELECT 
                p.id as "positionId",
                p."positionTitle" as "positionTitle",
                p."positionCode" as "positionCode"
            FROM employee_department_positions edp
            JOIN positions p ON edp."positionId" = p.id
            WHERE edp."employeeId" = $1 
            LIMIT 1
            `,
            [employeeId],
        );

        // 직원 정보에서 직급 정보 가져오기
        const rankResult = await this.dataSource.query(
            `
            SELECT 
                r.id as "rankId",
                r."rankName" as "rankName",
                r."rankCode" as "rankCode"
            FROM employees e
            LEFT JOIN ranks r ON e."currentRankId" = r.id
            WHERE e.id = $1
            LIMIT 1
            `,
            [employeeId],
        );

        return {
            position: assignmentResult[0]
                ? {
                      id: assignmentResult[0].positionId,
                      title: assignmentResult[0].positionTitle,
                      code: assignmentResult[0].positionCode,
                  }
                : null,
            rank: rankResult[0]?.rankId
                ? {
                      id: rankResult[0].rankId,
                      name: rankResult[0].rankName,
                      code: rankResult[0].rankCode,
                  }
                : null,
        };
    }

    /**
     * 부서별 직원 수 통계
     */
    async getDepartmentStats(): Promise<Map<string, number>> {
        const jsonPath = path.join(__dirname, 'november-2025-org-data.json');
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        const orgData = JSON.parse(jsonContent);

        const stats = new Map<string, number>();

        // 재귀적으로 통계 수집
        this.collectStatsRecursive(orgData.organization, stats);

        return stats;
    }

    /**
     * 재귀적으로 부서별 직원 수 수집
     */
    private collectStatsRecursive(department: any, stats: Map<string, number>): void {
        const departmentName = department.departmentName;
        const employeeCount = department.employees ? department.employees.length : 0;

        stats.set(departmentName, employeeCount);

        // 자식 부서들 재귀 처리
        if (department.children && Array.isArray(department.children)) {
            for (const childDept of department.children) {
                this.collectStatsRecursive(childDept, stats);
            }
        }
    }
}
