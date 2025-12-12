import { Injectable } from '@nestjs/common';
import { DomainEmployeeService } from '../../domain/employee/employee.service';
import { DomainDepartmentService } from '../../domain/department/department.service';
import { DomainPositionService } from '../../domain/position/position.service';
import { DomainRankService } from '../../domain/rank/rank.service';
import { DomainEmployeeDepartmentPositionService } from '../../domain/employee-department-position/employee-department-position.service';
import { DomainEmployeeTokenService } from '../../domain/employee-token/employee-token.service';
import { DomainEmployeeFcmTokenService } from '../../domain/employee-fcm-token/employee-fcm-token.service';
import { DomainEmployeeSystemRoleService } from '../../domain/employee-system-role/employee-system-role.service';
import {
    Department,
    Employee,
    Position,
    Rank,
    EmployeeDepartmentPosition,
} from '../../../../libs/database/entities';
import { EmployeeStatus } from '../../../../libs/common/enums';
import { DepartmentType } from '../../domain/department/department.entity';

/**
 * 조직 관리 조회 전담 서비스 (CQRS - Query)
 * 복잡한 조회 로직만 담당
 */
@Injectable()
export class OrganizationQueryService {
    constructor(
        private readonly 직원서비스: DomainEmployeeService,
        private readonly 부서서비스: DomainDepartmentService,
        private readonly 직책서비스: DomainPositionService,
        private readonly 직급서비스: DomainRankService,
        private readonly 직원부서직책서비스: DomainEmployeeDepartmentPositionService,
        private readonly 직원토큰서비스: DomainEmployeeTokenService,
        private readonly 직원FCM토큰서비스: DomainEmployeeFcmTokenService,
        private readonly 직원시스템역할서비스: DomainEmployeeSystemRoleService,
    ) {}

    /**
     * 전체 직원 정보를 상세하게 조회한다 (관리자용) - 최적화 버전
     * 부서, 직책, 직급, 토큰, FCM토큰, 시스템 역할 정보를 포함하여 조회
     * N+1 쿼리를 방지하기 위해 배치 조회 사용
     *
     * @param status 재직상태 (옵셔널)
     * @returns 직원 상세 정보 배열
     */
    async 전체_직원상세정보를_조회한다(status?: EmployeeStatus): Promise<any[]> {
        // 1. 직원 목록 조회 (재직상태 필터링)
        let employees: Employee[];
        if (status) {
            employees = await this.직원서비스.findByStatus(status);
        } else {
            employees = await this.직원서비스.findAll();
        }

        if (employees.length === 0) {
            return [];
        }

        const employeeIds = employees.map((emp) => emp.id);

        // 2. 모든 관련 데이터를 배치로 조회 (병렬 처리)
        const [allAssignments, allEmployeeTokens, allEmployeeFcmTokens, allEmployeeSystemRoles] = await Promise.all([
            this.직원부서직책서비스.findAllByEmployeeIds(employeeIds),
            this.직원토큰서비스.findByEmployeeIds(employeeIds),
            this.직원FCM토큰서비스.findByEmployeeIds(employeeIds),
            this.직원시스템역할서비스.findByEmployeeIds(employeeIds),
        ]);

        // 3. 필요한 부서, 직책, 직급 ID 수집
        const departmentIds = [...new Set(allAssignments.map((a) => a.departmentId))];
        const positionIds = [...new Set(allAssignments.map((a) => a.positionId))];
        const rankIds = [...new Set(employees.map((e) => e.currentRankId).filter((id) => id))];

        // 4. 부서, 직책, 직급 정보를 배치로 조회 (병렬 처리)
        const [departments, positions, ranks] = await Promise.all([
            departmentIds.length > 0 ? this.부서서비스.findByIds(departmentIds) : Promise.resolve([]),
            positionIds.length > 0 ? this.직책서비스.findByIds(positionIds) : Promise.resolve([]),
            rankIds.length > 0 ? this.직급서비스.findByIds(rankIds) : Promise.resolve([]),
        ]);

        // 5. Map으로 빠른 조회를 위한 인덱싱
        const departmentMap = new Map(departments.map((d) => [d.id, d]));
        const positionMap = new Map(positions.map((p) => [p.id, p]));
        const rankMap = new Map(ranks.map((r) => [r.id, r]));

        // 직원별 데이터를 그룹화
        const assignmentsByEmployee = new Map<string, typeof allAssignments>();
        const tokensByEmployee = new Map<string, typeof allEmployeeTokens>();
        const fcmTokensByEmployee = new Map<string, typeof allEmployeeFcmTokens>();
        const systemRolesByEmployee = new Map<string, typeof allEmployeeSystemRoles>();

        allAssignments.forEach((assignment) => {
            if (!assignmentsByEmployee.has(assignment.employeeId)) {
                assignmentsByEmployee.set(assignment.employeeId, []);
            }
            assignmentsByEmployee.get(assignment.employeeId)!.push(assignment);
        });

        allEmployeeTokens.forEach((token) => {
            if (!tokensByEmployee.has(token.employeeId)) {
                tokensByEmployee.set(token.employeeId, []);
            }
            tokensByEmployee.get(token.employeeId)!.push(token);
        });

        allEmployeeFcmTokens.forEach((fcmToken) => {
            if (!fcmTokensByEmployee.has(fcmToken.employeeId)) {
                fcmTokensByEmployee.set(fcmToken.employeeId, []);
            }
            fcmTokensByEmployee.get(fcmToken.employeeId)!.push(fcmToken);
        });

        allEmployeeSystemRoles.forEach((systemRole) => {
            if (!systemRolesByEmployee.has(systemRole.employeeId)) {
                systemRolesByEmployee.set(systemRole.employeeId, []);
            }
            systemRolesByEmployee.get(systemRole.employeeId)!.push(systemRole);
        });

        // 6. 직원별 상세 정보 조합 (메모리에서 처리)
        const employeesWithDetails = employees.map((employee) => {
            // 부서/직책 배치 정보
            const assignments = assignmentsByEmployee.get(employee.id) || [];
            const departmentsInfo = assignments.map((assignment) => {
                const department = departmentMap.get(assignment.departmentId);
                const position = positionMap.get(assignment.positionId);
                return {
                    assignmentId: assignment.id,
                    departmentId: department?.id || '',
                    departmentName: department?.departmentName || '',
                    departmentType: department?.type || '',
                    positionId: position?.id || '',
                    positionTitle: position?.positionTitle || '',
                    isManager: assignment.isManager,
                };
            });

            // 직급 정보
            let rankInfo = null;
            if (employee.currentRankId) {
                const rankEntity = rankMap.get(employee.currentRankId);
                if (rankEntity) {
                    rankInfo = {
                        rankId: rankEntity.id,
                        rankName: rankEntity.rankName,
                        rankCode: rankEntity.rankCode,
                        level: rankEntity.level,
                    };
                }
            }

            // 인증 토큰 정보
            const employeeTokensList = tokensByEmployee.get(employee.id) || [];
            const tokensInfo = employeeTokensList.map((et) => ({
                tokenId: et.tokenId,
                accessToken: et.token?.accessToken || '',
                tokenExpiresAt: et.token?.tokenExpiresAt || new Date(),
            }));

            // FCM 토큰 정보
            const employeeFcmTokensList = fcmTokensByEmployee.get(employee.id) || [];
            const fcmTokensInfo = employeeFcmTokensList.map((eft) => ({
                fcmTokenId: eft.fcmTokenId,
                fcmToken: eft.fcmToken?.fcmToken || '',
                deviceType: eft.fcmToken?.deviceType || '',
            }));

            // 시스템 역할 정보
            const employeeSystemRolesList = systemRolesByEmployee.get(employee.id) || [];
            const systemRolesInfo = employeeSystemRolesList.map((esr) => ({
                systemRoleId: esr.systemRoleId,
                systemId: esr.systemRole?.systemId || '',
                systemName: esr.systemRole?.system?.name || '',
                roleName: esr.systemRole?.roleName || '',
                roleCode: esr.systemRole?.roleCode || '',
            }));

            return {
                ...employee,
                departments: departmentsInfo,
                rank: rankInfo,
                tokens: tokensInfo,
                fcmTokens: fcmTokensInfo,
                systemRoles: systemRolesInfo,
            };
        });

        return employeesWithDetails;
    }

    /**
     * 부서 계층구조를 조회한다
     */
    async 부서_계층구조를_조회한다(
        rootDepartmentId?: string,
        maxDepth?: number,
        includeEmptyDepartments = true,
        includeInactiveDepartments = false,
    ): Promise<Department[]> {
        // 최상위 부서부터 시작하거나 지정된 부서부터 시작
        let rootDepartments: Department[];

        if (rootDepartmentId) {
            const rootDept = await this.부서서비스.findByIdWithParent(rootDepartmentId);
            rootDepartments = [rootDept];
        } else {
            rootDepartments = await this.부서서비스.findRootDepartments();
        }

        // 🚀 성능 최적화: 전체 부서 목록을 미리 조회 (배치 처리)
        const allDepartments = await this.부서서비스.findAllDepartmentsWithChildren();
        const departmentMap = new Map(allDepartments.map((dept) => [dept.id, dept]));

        // 계층구조 구축
        const result: Department[] = [];
        for (const rootDept of rootDepartments) {
            const hierarchyDept = this.부서_계층구조를_구축한다(
                rootDept,
                departmentMap,
                0,
                maxDepth,
                includeEmptyDepartments,
                includeInactiveDepartments,
            );
            if (hierarchyDept) {
                result.push(hierarchyDept);
            }
        }

        return result;
    }

    private 부서_계층구조를_구축한다(
        department: Department,
        departmentMap: Map<string, Department>,
        currentDepth: number,
        maxDepth?: number,
        includeEmptyDepartments = true,
        includeInactiveDepartments = false,
    ): Department | null {
        // 비활성화된 부서 필터링 (includeInactiveDepartments가 false일 때)
        if (!includeInactiveDepartments && department.isActive === false) {
            return null;
        }

        // 최대 깊이 체크
        if (maxDepth !== undefined && currentDepth >= maxDepth) {
            return department;
        }

        // 하위 부서들 조회
        const childDepartments: Department[] = [];
        const allChildren = Array.from(departmentMap.values()).filter(
            (dept) => dept.parentDepartmentId === department.id,
        );

        for (const childDept of allChildren) {
            const childHierarchy = this.부서_계층구조를_구축한다(
                childDept,
                departmentMap,
                currentDepth + 1,
                maxDepth,
                includeEmptyDepartments,
                includeInactiveDepartments,
            );
            if (childHierarchy) {
                childDepartments.push(childHierarchy);
            }
        }

        // 부서에 하위 부서들 설정
        department.childDepartments = childDepartments.sort((a, b) => a.order - b.order);

        return department;
    }

    /**
     * 부서별 직원 목록을 조회한다
     */
    async 부서별_직원_목록을_조회한다(
        departmentIds: string[],
        includeTerminated = false,
        withDetail = false,
    ): Promise<Map<string, { employees: Employee[]; departmentPositions: Map<string, any> }>> {
        if (departmentIds.length === 0) {
            return new Map();
        }

        // 🚀 성능 최적화: 배치로 모든 데이터를 한 번에 조회
        const [allEmployeeDeptPositions, allEmployees] = await Promise.all([
            // 1. 모든 부서의 직원-부서-직책 관계를 한 번에 조회
            this.직원부서직책서비스.findByDepartmentIds(departmentIds),
            // 2. 모든 직원 정보를 한 번에 조회 (부서별 필터링은 나중에)
            this.전체_활성_직원정보를_조회한다(includeTerminated),
        ]);

        // 직원 ID 맵 생성 (빠른 조회를 위해)
        const employeeMap = new Map(allEmployees.map((emp) => [emp.id, emp]));

        // 부서별로 그룹화
        const departmentEmployeesMap = new Map<
            string,
            { employees: Employee[]; departmentPositions: Map<string, any> }
        >();

        // 초기화: 모든 부서에 대해 빈 배열로 시작
        for (const departmentId of departmentIds) {
            departmentEmployeesMap.set(departmentId, {
                employees: [],
                departmentPositions: new Map(),
            });
        }

        // 직원-부서-직책 관계를 부서별로 그룹화
        for (const edp of allEmployeeDeptPositions) {
            const employee = employeeMap.get(edp.employeeId);

            // 직원이 존재하고, 요청된 부서에 속한 경우만 처리
            if (employee && departmentIds.includes(edp.departmentId)) {
                const deptInfo = departmentEmployeesMap.get(edp.departmentId)!;

                deptInfo.employees.push(employee);
                deptInfo.departmentPositions.set(edp.employeeId, {
                    positionId: edp.positionId,
                    isManager: edp.isManager,
                    createdAt: edp.createdAt,
                });
            }
        }

        return departmentEmployeesMap;
    }

    private async 전체_활성_직원정보를_조회한다(includeTerminated = false): Promise<Employee[]> {
        return this.직원서비스.findAllEmployees(includeTerminated);
    }

    /**
     * 부서 계층구조별 직원정보를 조회한다
     */
    async 부서_계층구조별_직원정보를_조회한다(
        rootDepartmentId?: string,
        maxDepth?: number,
        withEmployeeDetail = false,
        includeTerminated = false,
        includeEmptyDepartments = true,
        includeInactiveDepartments = false,
    ): Promise<{
        departments: Department[];
        employeesByDepartment: Map<string, { employees: Employee[]; departmentPositions: Map<string, any> }>;
        departmentDetails?: Map<string, { department: Department; position: Position; rank: Rank }[]>;
    }> {
        // 🚀 성능 최적화: 모든 데이터를 병렬로 조회
        const [departments] = await Promise.all([
            // 1. 부서 계층구조 조회
            this.부서_계층구조를_조회한다(
                rootDepartmentId,
                maxDepth,
                includeEmptyDepartments,
                includeInactiveDepartments,
            ),
        ]);
        // 2. 모든 부서 ID 수집 (재귀적으로)
        const allDepartmentIds = this.모든_부서_ID를_수집한다(departments);

        if (allDepartmentIds.length === 0) {
            return {
                departments,
                employeesByDepartment: new Map(),
                departmentDetails: undefined,
            };
        }

        // 🚀 성능 최적화: 직원 정보와 상세 정보를 병렬로 조회
        const [employeesByDepartment, departmentDetails] = await Promise.all([
            // 3. 부서별 직원 목록 조회
            this.부서별_직원_목록을_조회한다(allDepartmentIds, includeTerminated, withEmployeeDetail),
            // 4. 직원 상세 정보 병렬 조회
            withEmployeeDetail
                ? this.직원_상세정보를_병렬조회한다(allDepartmentIds, includeTerminated)
                : Promise.resolve(undefined),
        ]);

        return {
            departments,
            employeesByDepartment,
            departmentDetails,
        };
    }

    private async 직원_상세정보를_병렬조회한다(
        departmentIds: string[],
        includeTerminated = false,
    ): Promise<Map<string, { department: Department; position: Position; rank: Rank }[]> | undefined> {
        try {
            // 🚀 성능 최적화: 모든 필요한 데이터를 병렬로 조회
            const [employeeDeptPositions, departments, positions, ranks, employees] = await Promise.all([
                this.직원부서직책서비스.findByDepartmentIds(departmentIds),
                this.부서서비스.findByIds(departmentIds),
                this.직책서비스.findAllPositions(),
                this.직급서비스.findAllRanks(),
                this.직원서비스.findAllEmployees(includeTerminated),
            ]);

            // 빠른 조회를 위한 Map 생성
            const departmentMap = new Map(departments.map((dept) => [dept.id, dept]));
            const positionMap = new Map(positions.map((pos) => [pos.id, pos]));
            const rankMap = new Map(ranks.map((rank) => [rank.id, rank]));
            const employeeMap = new Map(employees.map((emp) => [emp.id, emp]));

            // 부서별 직원 상세 정보 매핑
            const departmentDetails = new Map<string, { department: Department; position: Position; rank: Rank }[]>();

            for (const edp of employeeDeptPositions) {
                const employee = employeeMap.get(edp.employeeId);
                const department = departmentMap.get(edp.departmentId);
                const position = positionMap.get(edp.positionId);

                if (employee && department && position) {
                    const rank = rankMap.get(employee.currentRankId);

                    if (rank) {
                        if (!departmentDetails.has(edp.departmentId)) {
                            departmentDetails.set(edp.departmentId, []);
                        }

                        departmentDetails.get(edp.departmentId)!.push({
                            department,
                            position,
                            rank,
                        });
                    }
                }
            }

            return departmentDetails;
        } catch (error) {
            console.error('직원 상세정보 조회 중 오류:', error);
            return undefined;
        }
    }

    private 모든_부서_ID를_수집한다(departments: Department[]): string[] {
        const departmentIds: string[] = [];

        const collectIds = (depts: Department[]) => {
            for (const dept of depts) {
                departmentIds.push(dept.id);
                if (dept.childDepartments && dept.childDepartments.length > 0) {
                    collectIds(dept.childDepartments);
                }
            }
        };

        collectIds(departments);
        return departmentIds;
    }

    /**
     * 조직도 통계를 조회한다
     */
    async 조직도_통계를_조회한다(): Promise<{
        총_부서수: number;
        총_직원수: number;
        활성_직원수: number;
        휴직_직원수: number;
        퇴사_직원수: number;
        직책별_통계: Array<{ 직책명: string; 인원수: number }>;
        직급별_통계: Array<{ 직급명: string; 인원수: number }>;
    }> {
        // 모든 데이터를 병렬로 조회
        const [departments, allEmployees, positions, ranks, assignments] = await Promise.all([
            this.부서서비스.findAllDepartmentsWithChildren(),
            this.직원서비스.findAllEmployees(true), // 퇴사자 포함
            this.직책서비스.findAllPositions(),
            this.직급서비스.findAllRanks(),
            this.직원부서직책서비스.findAllAssignments(),
        ]);

        // 직원 상태별 통계
        const 활성_직원수 = allEmployees.filter((emp) => emp.status === '재직중').length;
        const 휴직_직원수 = allEmployees.filter((emp) => emp.status === '휴직').length;
        const 퇴사_직원수 = allEmployees.filter((emp) => emp.status === '퇴사').length;

        // 직책별 통계
        const positionMap = new Map(positions.map((pos) => [pos.id, pos.positionTitle]));
        const positionStats = new Map<string, number>();

        for (const assignment of assignments) {
            const positionTitle = positionMap.get(assignment.positionId) || '알 수 없음';
            positionStats.set(positionTitle, (positionStats.get(positionTitle) || 0) + 1);
        }

        // 직급별 통계
        const rankMap = new Map(ranks.map((rank) => [rank.id, rank.rankName]));
        const rankStats = new Map<string, number>();

        for (const employee of allEmployees) {
            if (employee.currentRankId) {
                const rankName = rankMap.get(employee.currentRankId) || '알 수 없음';
                rankStats.set(rankName, (rankStats.get(rankName) || 0) + 1);
            }
        }

        return {
            총_부서수: this.모든_부서_개수를_계산한다(departments),
            총_직원수: allEmployees.length,
            활성_직원수,
            휴직_직원수,
            퇴사_직원수,
            직책별_통계: Array.from(positionStats.entries()).map(([직책명, 인원수]) => ({ 직책명, 인원수 })),
            직급별_통계: Array.from(rankStats.entries()).map(([직급명, 인원수]) => ({ 직급명, 인원수 })),
        };
    }

    private 모든_부서_개수를_계산한다(departments: Department[]): number {
        let count = departments.length;

        for (const dept of departments) {
            if (dept.childDepartments) {
                count += this.모든_부서_개수를_계산한다(dept.childDepartments);
            }
        }

        return count;
    }

    /**
     * 전체 직원의 부서 직속 라인 관리자 정보를 조회한다
     * 각 직원의 소속 부서부터 최상위 부서까지 올라가면서 isManager=true인 직원들을 찾는다
     *
     * @param includeTerminated 퇴사한 직원 포함 여부 (기본값: false)
     * @returns 직원별 관리자 라인 정보
     */
    async 전체_직원의_관리자_라인을_조회한다(includeTerminated = false): Promise<
        {
            employeeId: string;
            name: string;
            employeeNumber: string;
            departments: Array<{
                departmentId: string;
                departmentName: string;
                managerLine: Array<{
                    departmentId: string;
                    departmentName: string;
                    departmentCode: string;
                    type: any;
                    parentDepartmentId?: string;
                    depth: number;
                    managers: Array<{
                        employeeId: string;
                        name: string;
                        employeeNumber: string;
                        email?: string;
                        positionId: string;
                        positionTitle: string;
                    }>;
                }>;
            }>;
        }[]
    > {
        // 1. 전체 직원 조회
        const employees = await this.직원서비스.findAllEmployees(includeTerminated);

        if (employees.length === 0) {
            return [];
        }

        // 2. 성능 최적화: 필요한 모든 데이터를 배치로 조회
        const employeeIds = employees.map((emp) => emp.id);

        const [allAssignments, allDepartments, allPositions] = await Promise.all([
            // 직원-부서-직책 매핑 정보 (가장 최근 배치 정보 찾기 위해)
            this.직원부서직책서비스.findAllByEmployeeIds(employeeIds),
            // 모든 부서 정보
            this.부서서비스.findAllDepartments(),
            // 모든 직책 정보
            this.직책서비스.findAllPositions(),
        ]);

        // 3. 빠른 조회를 위한 Map 생성
        const departmentMap = new Map(allDepartments.map((dept) => [dept.id, dept]));
        const positionMap = new Map(allPositions.map((pos) => [pos.id, pos]));

        // 직원별 모든 배치 정보 그룹화
        const employeeAssignmentsMap = new Map<string, EmployeeDepartmentPosition[]>();
        for (const assignment of allAssignments) {
            const assignments = employeeAssignmentsMap.get(assignment.employeeId) || [];
            assignments.push(assignment);
            employeeAssignmentsMap.set(assignment.employeeId, assignments);
        }

        // 4. 부서별 관리자 조회 (isManager = true인 배치 정보)
        const managersByDepartmentMap = new Map<string, EmployeeDepartmentPosition[]>();
        for (const assignment of allAssignments) {
            if (assignment.isManager) {
                const managers = managersByDepartmentMap.get(assignment.departmentId) || [];
                managers.push(assignment);
                managersByDepartmentMap.set(assignment.departmentId, managers);
            }
        }

        // 5. 각 직원에 대해 모든 부서의 관리자 라인 구성
        const result: Array<{
            employeeId: string;
            name: string;
            employeeNumber: string;
            departments: Array<{
                departmentId: string;
                departmentName: string;
                managerLine: Array<{
                    departmentId: string;
                    departmentName: string;
                    departmentCode: string;
                    type: any;
                    parentDepartmentId?: string;
                    depth: number;
                    managers: Array<{
                        employeeId: string;
                        name: string;
                        employeeNumber: string;
                        email?: string;
                        positionId: string;
                        positionTitle: string;
                    }>;
                }>;
            }>;
        }> = [];

        for (const employee of employees) {
            const employeeAssignments = employeeAssignmentsMap.get(employee.id);

            // 직원이 배치되어 있지 않은 경우 스킵
            if (!employeeAssignments || employeeAssignments.length === 0) {
                continue;
            }

            // 직원의 모든 부서에 대해 관리자 라인 구성
            const departments: Array<{
                departmentId: string;
                departmentName: string;
                managerLine: Array<{
                    departmentId: string;
                    departmentName: string;
                    departmentCode: string;
                    type: any;
                    parentDepartmentId?: string;
                    depth: number;
                    managers: Array<{
                        employeeId: string;
                        name: string;
                        employeeNumber: string;
                        email?: string;
                        positionId: string;
                        positionTitle: string;
                    }>;
                }>;
            }> = [];

            // 각 배치된 부서에 대해 관리자 라인 구성
            for (const assignment of employeeAssignments) {
                const currentDepartmentId = assignment.departmentId;
                const currentDepartment = departmentMap.get(currentDepartmentId);

                // 부서 정보가 없는 경우 스킵
                if (!currentDepartment) {
                    continue;
                }

                // 부서 계층을 올라가면서 관리자 찾기
                const managerLine: Array<{
                    departmentId: string;
                    departmentName: string;
                    departmentCode: string;
                    type: any;
                    parentDepartmentId?: string;
                    depth: number;
                    managers: Array<{
                        employeeId: string;
                        name: string;
                        employeeNumber: string;
                        email?: string;
                        positionId: string;
                        positionTitle: string;
                    }>;
                }> = [];

                let currentDeptId: string | undefined = currentDepartmentId;
                let depth = 0;

                // 최상위 부서까지 반복
                while (currentDeptId) {
                    const dept = departmentMap.get(currentDeptId);
                    if (!dept) {
                        break;
                    }

                    // 해당 부서의 관리자들 조회
                    const managerAssignments = managersByDepartmentMap.get(currentDeptId) || [];
                    const managers = managerAssignments
                        .map((managerAssignment) => {
                            const managerEmployee = employees.find((emp) => emp.id === managerAssignment.employeeId);
                            if (!managerEmployee) {
                                return null;
                            }

                            const position = positionMap.get(managerAssignment.positionId);
                            if (!position) {
                                return null;
                            }

                            return {
                                employeeId: managerEmployee.id,
                                name: managerEmployee.name,
                                employeeNumber: managerEmployee.employeeNumber,
                                email: managerEmployee.email,
                                positionId: position.id,
                                positionTitle: position.positionTitle,
                            };
                        })
                        .filter((m): m is NonNullable<typeof m> => m !== null);

                    // 관리자 라인에 추가
                    managerLine.push({
                        departmentId: dept.id,
                        departmentName: dept.departmentName,
                        departmentCode: dept.departmentCode,
                        type: dept.type,
                        parentDepartmentId: dept.parentDepartmentId,
                        depth,
                        managers,
                    });

                    // 상위 부서로 이동
                    currentDeptId = dept.parentDepartmentId;
                    depth++;
                }

                departments.push({
                    departmentId: currentDepartment.id,
                    departmentName: currentDepartment.departmentName,
                    managerLine,
                });
            }

            result.push({
                employeeId: employee.id,
                name: employee.name,
                employeeNumber: employee.employeeNumber,
                departments,
            });
        }

        return result;
    }
}

