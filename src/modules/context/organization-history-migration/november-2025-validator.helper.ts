import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 11월 조직도 데이터 검증 헬퍼
 */
@Injectable()
export class November2025ValidatorHelper {
    private readonly logger = new Logger(November2025ValidatorHelper.name);

    constructor(private readonly dataSource: DataSource) {}

    /**
     * JSON 데이터 검증 (실행 전 사전 체크)
     */
    async validateJsonData(): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        stats: {
            totalDepartments: number;
            totalEmployees: number;
            missingDepartments: string[];
            missingEmployees: string[];
            duplicateEmployees: Array<{ name: string; count: number; departments: string[] }>;
        };
    }> {
        this.logger.log('='.repeat(80));
        this.logger.log('11월 조직도 데이터 검증 시작');
        this.logger.log('='.repeat(80));

        const errors: string[] = [];
        const warnings: string[] = [];

        // JSON 파일 읽기
        const jsonPath = path.join(__dirname, 'november-2025-org-data.json');
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        const orgData = JSON.parse(jsonContent);

        // 통계 수집
        const departmentNames: string[] = [];
        const employeeNames: string[] = [];
        const employeeDepartments = new Map<string, string[]>();

        this.collectNames(orgData.organization, departmentNames, employeeNames, employeeDepartments);

        // 부서 존재 여부 확인
        const missingDepartments: string[] = [];
        for (const deptName of departmentNames) {
            const exists = await this.departmentExists(deptName);
            if (!exists) {
                missingDepartments.push(deptName);
                errors.push(`부서를 찾을 수 없음: ${deptName}`);
            }
        }

        // 직원 존재 여부 확인
        const missingEmployees: string[] = [];
        const uniqueEmployees = [...new Set(employeeNames)];
        for (const empName of uniqueEmployees) {
            const exists = await this.employeeExists(empName);
            if (!exists) {
                missingEmployees.push(empName);
                errors.push(`직원을 찾을 수 없음: ${empName}`);
            }
        }

        // 중복 직원 (겸직자) 확인
        const duplicateEmployees: Array<{ name: string; count: number; departments: string[] }> = [];
        for (const [name, depts] of employeeDepartments.entries()) {
            if (depts.length > 1) {
                duplicateEmployees.push({
                    name,
                    count: depts.length,
                    departments: depts,
                });
                warnings.push(`겸직자: ${name} (${depts.length}개 부서: ${depts.join(', ')})`);
            }
        }

        const isValid = errors.length === 0;

        // 결과 출력
        this.logger.log('='.repeat(80));
        this.logger.log('검증 결과');
        this.logger.log(`- 총 부서: ${departmentNames.length}개`);
        this.logger.log(`- 총 직원: ${employeeNames.length}명 (고유: ${uniqueEmployees.length}명)`);
        this.logger.log(`- 누락 부서: ${missingDepartments.length}개`);
        this.logger.log(`- 누락 직원: ${missingEmployees.length}명`);
        this.logger.log(`- 겸직자: ${duplicateEmployees.length}명`);

        if (errors.length > 0) {
            this.logger.error(`❌ 검증 실패: ${errors.length}개 오류`);
            errors.forEach((err) => this.logger.error(`   - ${err}`));
        } else {
            this.logger.log('✅ 검증 성공: 모든 데이터가 유효함');
        }

        if (warnings.length > 0) {
            this.logger.warn(`⚠️  경고: ${warnings.length}개`);
            warnings.forEach((warn) => this.logger.warn(`   - ${warn}`));
        }

        this.logger.log('='.repeat(80));

        return {
            isValid,
            errors,
            warnings,
            stats: {
                totalDepartments: departmentNames.length,
                totalEmployees: uniqueEmployees.length,
                missingDepartments,
                missingEmployees,
                duplicateEmployees,
            },
        };
    }

    /**
     * 재귀적으로 부서명, 직원명 수집
     */
    private collectNames(
        department: any,
        departmentNames: string[],
        employeeNames: string[],
        employeeDepartments: Map<string, string[]>,
    ): void {
        departmentNames.push(department.departmentName);

        if (department.employees && Array.isArray(department.employees)) {
            for (const emp of department.employees) {
                employeeNames.push(emp.name);

                // 직원-부서 매핑
                if (!employeeDepartments.has(emp.name)) {
                    employeeDepartments.set(emp.name, []);
                }
                employeeDepartments.get(emp.name)!.push(department.departmentName);
            }
        }

        if (department.children && Array.isArray(department.children)) {
            for (const child of department.children) {
                this.collectNames(child, departmentNames, employeeNames, employeeDepartments);
            }
        }
    }

    /**
     * 부서 존재 여부 확인
     */
    private async departmentExists(departmentName: string): Promise<boolean> {
        const result = await this.dataSource.query(`SELECT id FROM departments WHERE "departmentName" = $1 LIMIT 1`, [
            departmentName,
        ]);
        return result.length > 0;
    }

    /**
     * 직원 존재 여부 확인
     */
    private async employeeExists(name: string): Promise<boolean> {
        const result = await this.dataSource.query(`SELECT id FROM employees WHERE name = $1 LIMIT 1`, [name]);
        return result.length > 0;
    }

    /**
     * 부서 매핑 제안
     */
    async suggestDepartmentMapping(): Promise<
        Array<{
            jsonName: string;
            possibleMatches: Array<{ dbName: string; similarity: number }>;
        }>
    > {
        // JSON에서 부서명 수집
        const jsonPath = path.join(__dirname, 'november-2025-org-data.json');
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        const orgData = JSON.parse(jsonContent);

        const departmentNames: string[] = [];
        this.collectDepartmentNames(orgData.organization, departmentNames);

        // DB에서 부서 목록 조회
        const dbDepartments = await this.dataSource.query(`SELECT "departmentName" FROM departments`);
        const dbDepartmentNames = dbDepartments.map((d: any) => d.departmentName);

        // 매칭 제안
        const suggestions: Array<{
            jsonName: string;
            possibleMatches: Array<{ dbName: string; similarity: number }>;
        }> = [];

        for (const jsonName of departmentNames) {
            // 정확히 일치하는 경우 스킵
            if (dbDepartmentNames.includes(jsonName)) {
                continue;
            }

            // 유사한 부서명 찾기
            const matches: Array<{ dbName: string; similarity: number }> = [];
            for (const dbName of dbDepartmentNames) {
                const similarity = this.calculateSimilarity(jsonName, dbName);
                if (similarity > 0.5) {
                    matches.push({ dbName, similarity });
                }
            }

            matches.sort((a, b) => b.similarity - a.similarity);

            if (matches.length > 0) {
                suggestions.push({
                    jsonName,
                    possibleMatches: matches.slice(0, 3), // 상위 3개만
                });
            }
        }

        return suggestions;
    }

    /**
     * 재귀적으로 부서명만 수집
     */
    private collectDepartmentNames(department: any, departmentNames: string[]): void {
        departmentNames.push(department.departmentName);

        if (department.children && Array.isArray(department.children)) {
            for (const child of department.children) {
                this.collectDepartmentNames(child, departmentNames);
            }
        }
    }

    /**
     * 문자열 유사도 계산 (간단한 Levenshtein 거리 기반)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) {
            return 1.0;
        }

        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Levenshtein 거리 계산
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }
}
