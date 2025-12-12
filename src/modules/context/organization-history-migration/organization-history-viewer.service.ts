import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * 부서 정보 (계층구조용)
 */
export interface DepartmentNode {
    departmentId: string;
    departmentCode: string;
    departmentName: string;
    departmentType: string;
    level: number;
    parentDepartmentId: string | null;
    employees: EmployeeInfo[];
    children: DepartmentNode[];
}

/**
 * 직원 정보 (간단)
 */
export interface EmployeeInfo {
    employeeId: string;
    employeeNumber: string;
    employeeName: string;
    positionTitle: string;
    positionCode: string;
    rankName: string | null;
    rankCode: string | null;
    isManager: boolean;
}

/**
 * 11월 조직도 뷰
 */
export interface November2025OrgView {
    effectiveDate: string;
    description: string;
    totalDepartments: number;
    totalEmployees: number;
    organization: DepartmentNode;
}

/**
 * 12월 조직도 뷰
 */
export interface December2025OrgView {
    effectiveDate: string;
    description: string;
    totalDepartments: number;
    totalEmployees: number;
    organization: DepartmentNode;
}

/**
 * 변화 내역
 */
export interface OrganizationChange {
    employeeId: string;
    employeeNumber: string;
    employeeName: string;
    changeType: 'DEPARTMENT_CHANGE' | 'POSITION_CHANGE' | 'BOTH_CHANGE';
    november: {
        departmentName: string;
        departmentCode: string;
        positionTitle: string;
        positionCode: string;
        rankName: string | null;
        isManager: boolean;
    };
    december: {
        departmentName: string;
        departmentCode: string;
        positionTitle: string;
        positionCode: string;
        rankName: string | null;
        isManager: boolean;
    };
}

/**
 * 조직 변화 요약
 */
export interface OrganizationChangeSummary {
    totalChanges: number;
    departmentChanges: number;
    positionChanges: number;
    bothChanges: number;
    changes: OrganizationChange[];
}

/**
 * 조직도 이력 조회 서비스
 * 11월과 12월 조직도를 계층구조로 조회하고 변화 내역을 제공합니다
 */
@Injectable()
export class OrganizationHistoryViewerService {
    private readonly logger = new Logger(OrganizationHistoryViewerService.name);

    constructor(private readonly dataSource: DataSource) {}

    /**
     * 11월 조직도를 계층구조로 조회합니다
     */
    async get11월조직도(): Promise<November2025OrgView> {
        this.logger.log('11월 조직도 조회 시작');

        // 11월 30일 기준 조직도 조회 (해당 날짜에 유효했던 이력)
        const novemberData = await this.dataSource.query(
            `
            WITH RECURSIVE dept_hierarchy AS (
                -- 루트 부서 (parentDepartmentId IS NULL)
                SELECT 
                    id,
                    "departmentCode",
                    "departmentName",
                    type,
                    "parentDepartmentId",
                    "order",
                    0 as level
                FROM departments
                WHERE "parentDepartmentId" IS NULL
                
                UNION ALL
                
                -- 하위 부서들
                SELECT 
                    d.id,
                    d."departmentCode",
                    d."departmentName",
                    d.type,
                    d."parentDepartmentId",
                    d."order",
                    dh.level + 1
                FROM departments d
                INNER JOIN dept_hierarchy dh ON d."parentDepartmentId" = dh.id
            )
            SELECT 
                h."historyId",
                h."employeeId",
                h."departmentId",
                h."positionId",
                h."rankId",
                h."isManager",
                e."employeeNumber",
                e."name" as "employeeName",
                dh."departmentCode",
                dh."departmentName",
                dh.type as "departmentType",
                dh.level,
                dh."parentDepartmentId",
                p."positionTitle",
                p."positionCode",
                r."rankName",
                r."rankCode",
                d."isException"
            FROM employee_department_position_history h
            JOIN employees e ON h."employeeId" = e.id
            JOIN dept_hierarchy dh ON h."departmentId" = dh.id
            JOIN departments d ON h."departmentId" = d.id
            JOIN positions p ON h."positionId" = p.id
            LEFT JOIN ranks r ON h."rankId" = r.id
            WHERE h."effectiveStartDate" <= '2025-11-30'
            AND (h."effectiveEndDate" >= '2025-11-30' OR h."effectiveEndDate" IS NULL OR h."isCurrent" = true)
            AND d."isException" = false
            ORDER BY dh.level, dh."departmentCode", e."employeeNumber"
            `,
        );

        this.logger.log(`11월 이력 데이터 ${novemberData.length}건 조회 완료`);

        // 계층구조 생성
        const organization = await this.build계층구조(novemberData);

        // 부서 및 직원 수 계산
        const stats = this.calculate통계(organization);

        return {
            effectiveDate: '2025-11-30',
            description: '2025년 11월 조직도 (조직개편 이전)',
            totalDepartments: stats.departmentCount,
            totalEmployees: stats.employeeCount,
            organization,
        };
    }

    /**
     * 12월 조직도를 계층구조로 조회합니다
     */
    async get12월조직도(): Promise<December2025OrgView> {
        this.logger.log('12월 조직도 조회 시작');

        // 12월 1일 기준 조직도 조회 (해당 날짜에 유효했던 이력)
        const decemberData = await this.dataSource.query(
            `
            WITH RECURSIVE dept_hierarchy AS (
                -- 루트 부서 (parentDepartmentId IS NULL)
                SELECT 
                    id,
                    "departmentCode",
                    "departmentName",
                    type,
                    "parentDepartmentId",
                    "order",
                    0 as level
                FROM departments
                WHERE "parentDepartmentId" IS NULL
                
                UNION ALL
                
                -- 하위 부서들
                SELECT 
                    d.id,
                    d."departmentCode",
                    d."departmentName",
                    d.type,
                    d."parentDepartmentId",
                    d."order",
                    dh.level + 1
                FROM departments d
                INNER JOIN dept_hierarchy dh ON d."parentDepartmentId" = dh.id
            )
            SELECT 
                h."historyId",
                h."employeeId",
                h."departmentId",
                h."positionId",
                h."rankId",
                h."isManager",
                e."employeeNumber",
                e."name" as "employeeName",
                dh."departmentCode",
                dh."departmentName",
                dh.type as "departmentType",
                dh.level,
                dh."parentDepartmentId",
                p."positionTitle",
                p."positionCode",
                r."rankName",
                r."rankCode",
                d."isException"
            FROM employee_department_position_history h
            JOIN employees e ON h."employeeId" = e.id
            JOIN dept_hierarchy dh ON h."departmentId" = dh.id
            JOIN departments d ON h."departmentId" = d.id
            JOIN positions p ON h."positionId" = p.id
            LEFT JOIN ranks r ON h."rankId" = r.id
            WHERE h."effectiveStartDate" <= '2025-12-01'
            AND (h."effectiveEndDate" >= '2025-12-01' OR h."effectiveEndDate" IS NULL OR h."isCurrent" = true)
            AND d."isException" = false
            ORDER BY dh.level, dh."departmentCode", e."employeeNumber"
            `,
        );

        this.logger.log(`12월 현재 이력 데이터 ${decemberData.length}건 조회 완료`);

        // 계층구조 생성
        const organization = await this.build계층구조(decemberData);

        // 부서 및 직원 수 계산
        const stats = this.calculate통계(organization);

        return {
            effectiveDate: '2025-12-01',
            description: '2025년 12월 조직도 (조직개편 이후)',
            totalDepartments: stats.departmentCount,
            totalEmployees: stats.employeeCount,
            organization,
        };
    }

    /**
     * 11월과 12월 조직도의 변화 내역을 조회합니다
     */
    async get조직변화내역(): Promise<OrganizationChangeSummary> {
        this.logger.log('조직 변화 내역 조회 시작');

        // 11월과 12월 데이터를 직원별로 조인하여 비교
        const changes = await this.dataSource.query(
            `
            WITH november_org AS (
                SELECT 
                    h."employeeId",
                    h."departmentId" as "novDeptId",
                    h."positionId" as "novPosId",
                    h."rankId" as "novRankId",
                    h."isManager" as "novIsManager",
                    d."departmentName" as "novDeptName",
                    d."departmentCode" as "novDeptCode",
                    p."positionTitle" as "novPosTitle",
                    p."positionCode" as "novPosCode",
                    r."rankName" as "novRankName"
                FROM employee_department_position_history h
                JOIN departments d ON h."departmentId" = d.id
                JOIN positions p ON h."positionId" = p.id
                LEFT JOIN ranks r ON h."rankId" = r.id
                WHERE h."effectiveStartDate" <= '2025-11-30'
                AND (h."effectiveEndDate" >= '2025-11-30' OR h."effectiveEndDate" IS NULL OR h."isCurrent" = true)
                AND d."isException" = false
            ),
            december_org AS (
                SELECT 
                    h."employeeId",
                    h."departmentId" as "decDeptId",
                    h."positionId" as "decPosId",
                    h."rankId" as "decRankId",
                    h."isManager" as "decIsManager",
                    d."departmentName" as "decDeptName",
                    d."departmentCode" as "decDeptCode",
                    p."positionTitle" as "decPosTitle",
                    p."positionCode" as "decPosCode",
                    r."rankName" as "decRankName"
                FROM employee_department_position_history h
                JOIN departments d ON h."departmentId" = d.id
                JOIN positions p ON h."positionId" = p.id
                LEFT JOIN ranks r ON h."rankId" = r.id
                WHERE h."effectiveStartDate" <= '2025-12-01'
                AND (h."effectiveEndDate" >= '2025-12-01' OR h."effectiveEndDate" IS NULL OR h."isCurrent" = true)
                AND d."isException" = false
            )
            SELECT 
                e."employeeNumber",
                e."name" as "employeeName",
                nov.*,
                dec.*
            FROM november_org nov
            JOIN december_org dec ON nov."employeeId" = dec."employeeId"
            JOIN employees e ON nov."employeeId" = e.id
            WHERE nov."novDeptId" != dec."decDeptId" 
               OR nov."novPosId" != dec."decPosId"
            ORDER BY e."employeeNumber"
            `,
        );

        this.logger.log(`조직 변화 ${changes.length}건 조회 완료`);

        // 변화 타입별로 분류
        const processedChanges: OrganizationChange[] = changes.map((row) => {
            const deptChanged = row.novDeptId !== row.decDeptId;
            const posChanged = row.novPosId !== row.decPosId;

            let changeType: OrganizationChange['changeType'];
            if (deptChanged && posChanged) {
                changeType = 'BOTH_CHANGE';
            } else if (deptChanged) {
                changeType = 'DEPARTMENT_CHANGE';
            } else {
                changeType = 'POSITION_CHANGE';
            }

            return {
                employeeId: row.employeeId,
                employeeNumber: row.employeeNumber,
                employeeName: row.employeeName,
                changeType,
                november: {
                    departmentName: row.novDeptName,
                    departmentCode: row.novDeptCode,
                    positionTitle: row.novPosTitle,
                    positionCode: row.novPosCode,
                    rankName: row.novRankName,
                    isManager: row.novIsManager,
                },
                december: {
                    departmentName: row.decDeptName,
                    departmentCode: row.decDeptCode,
                    positionTitle: row.decPosTitle,
                    positionCode: row.decPosCode,
                    rankName: row.decRankName,
                    isManager: row.decIsManager,
                },
            };
        });

        const departmentChanges = processedChanges.filter((c) =>
            ['DEPARTMENT_CHANGE', 'BOTH_CHANGE'].includes(c.changeType),
        ).length;
        const positionChanges = processedChanges.filter((c) =>
            ['POSITION_CHANGE', 'BOTH_CHANGE'].includes(c.changeType),
        ).length;
        const bothChanges = processedChanges.filter((c) => c.changeType === 'BOTH_CHANGE').length;

        return {
            totalChanges: processedChanges.length,
            departmentChanges,
            positionChanges,
            bothChanges,
            changes: processedChanges,
        };
    }

    /**
     * 계층구조를 생성합니다
     */
    private async build계층구조(data: any[]): Promise<DepartmentNode> {
        // 부서별로 그룹화
        const departmentMap = new Map<string, DepartmentNode>();

        // 부서 노드 생성
        for (const row of data) {
            if (!departmentMap.has(row.departmentId)) {
                departmentMap.set(row.departmentId, {
                    departmentId: row.departmentId,
                    departmentCode: row.departmentCode,
                    departmentName: row.departmentName,
                    departmentType: row.departmentType,
                    level: row.level,
                    parentDepartmentId: row.parentDepartmentId,
                    employees: [],
                    children: [],
                });
            }

            // 직원 추가
            const dept = departmentMap.get(row.departmentId)!;
            dept.employees.push({
                employeeId: row.employeeId,
                employeeNumber: row.employeeNumber,
                employeeName: row.employeeName,
                positionTitle: row.positionTitle,
                positionCode: row.positionCode,
                rankName: row.rankName,
                rankCode: row.rankCode,
                isManager: row.isManager,
            });
        }

        // 계층구조 구축
        const departments = Array.from(departmentMap.values());
        const rootDepartments: DepartmentNode[] = [];

        for (const dept of departments) {
            if (!dept.parentDepartmentId) {
                rootDepartments.push(dept);
            } else {
                const parent = departmentMap.get(dept.parentDepartmentId);
                if (parent) {
                    parent.children.push(dept);
                } else {
                    // 부모를 찾지 못한 경우 최상위로 추가
                    rootDepartments.push(dept);
                }
            }
        }

        // level과 departmentCode 기준으로 정렬
        this.sort계층구조(rootDepartments);

        // 최상위 부서가 하나면 그것을 반환
        if (rootDepartments.length === 1) {
            return rootDepartments[0];
        }

        // 여러 개인 경우: "루미르 주식회사" 또는 type='COMPANY'인 부서를 찾아서 메인 루트로 사용
        const companyDept = rootDepartments.find(
            (dept) => dept.departmentName === '루미르 주식회사' || dept.departmentType === 'COMPANY',
        );

        if (companyDept) {
            // 루미르 주식회사를 찾았으면, 나머지 루트 부서들을 그 아래 children으로 이동
            const otherRoots = rootDepartments.filter((dept) => dept.departmentId !== companyDept.departmentId);

            // 나머지 루트들을 회사 부서의 children에 추가
            companyDept.children.unshift(...otherRoots);

            return companyDept;
        }

        // 루미르 주식회사를 못 찾았으면 데이터베이스에서 조회
        const rootDepartment = await this.dataSource.query(
            `SELECT 
                id as "departmentId",
                "departmentCode",
                "departmentName",
                type as "departmentType"
            FROM departments
            WHERE "parentDepartmentId" IS NULL
            AND ("departmentName" = '루미르 주식회사' OR type = 'COMPANY')
            ORDER BY "order"
            LIMIT 1`,
        );

        if (rootDepartment.length > 0) {
            // 데이터베이스에서 찾은 루트 부서 사용
            const dbRoot = rootDepartment[0];
            // 기존 rootDepartments에서 동일한 ID를 가진 부서가 있으면 제거
            const otherRoots = rootDepartments.filter((dept) => dept.departmentId !== dbRoot.departmentId);

            return {
                departmentId: dbRoot.departmentId,
                departmentCode: dbRoot.departmentCode,
                departmentName: dbRoot.departmentName,
                departmentType: dbRoot.departmentType,
                level: 0,
                parentDepartmentId: null,
                employees: departmentMap.get(dbRoot.departmentId)?.employees || [],
                children: [...(departmentMap.get(dbRoot.departmentId)?.children || []), ...otherRoots],
            };
        }

        // 그래도 없으면 가상의 루트 생성 (fallback)
        this.logger.warn('실제 루트 부서를 찾을 수 없어 가상의 루트를 생성합니다.');
        return {
            departmentId: 'root',
            departmentCode: 'ROOT',
            departmentName: '루미르 주식회사',
            departmentType: 'COMPANY',
            level: 0,
            parentDepartmentId: null,
            employees: [],
            children: rootDepartments,
        };
    }

    /**
     * 계층구조를 재귀적으로 정렬합니다
     */
    private sort계층구조(nodes: DepartmentNode[]): void {
        nodes.sort((a, b) => {
            if (a.level !== b.level) return a.level - b.level;
            return a.departmentCode.localeCompare(b.departmentCode);
        });

        for (const node of nodes) {
            if (node.children.length > 0) {
                this.sort계층구조(node.children);
            }
            // 직원도 사번 순으로 정렬
            node.employees.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));
        }
    }

    /**
     * 통계를 계산합니다
     */
    private calculate통계(node: DepartmentNode): {
        departmentCount: number;
        employeeCount: number;
    } {
        let departmentCount = 1;
        let employeeCount = node.employees.length;

        for (const child of node.children) {
            const childStats = this.calculate통계(child);
            departmentCount += childStats.departmentCount;
            employeeCount += childStats.employeeCount;
        }

        return { departmentCount, employeeCount };
    }
}
