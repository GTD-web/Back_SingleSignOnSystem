import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { EmployeeManagementContextService } from './employee-management-context.service';
import { DepartmentManagementContextService } from './department-management-context.service';
import { PositionManagementContextService } from './position-management-context.service';
import { RankManagementContextService } from './rank-management-context.service';
import { AssignmentManagementContextService } from './assignment-management-context.service';
import { OrganizationQueryService } from './organization-query.service';
import {
    Department,
    Employee,
    Position,
    Rank,
    EmployeeDepartmentPosition,
    EmployeeRankHistory,
} from '../../../../libs/database/entities';
import { EmployeeStatus, Gender } from '../../../../libs/common/enums';

/**
 * 조직 관리 통합 Facade 서비스
 * 모든 하위 Context를 주입받아 위임하는 Facade 패턴
 * 기존 코드와의 하위 호환성 유지
 */
@Injectable()
export class OrganizationManagementContextService {
    constructor(
        private readonly employeeContext: EmployeeManagementContextService,
        private readonly departmentContext: DepartmentManagementContextService,
        private readonly positionContext: PositionManagementContextService,
        private readonly rankContext: RankManagementContextService,
        private readonly assignmentContext: AssignmentManagementContextService,
        private readonly queryService: OrganizationQueryService,
    ) {}

    // ==================== 직원 조회 관련 ====================

    async 직원을_조회한다(identifier: string, throwOnNotFound = true): Promise<Employee | null> {
        return this.employeeContext.직원을_조회한다(identifier, throwOnNotFound);
    }

    async 여러_직원을_조회한다(identifiers: string[], includeTerminated = false): Promise<Employee[]> {
        return this.employeeContext.여러_직원을_조회한다(identifiers, includeTerminated);
    }

    async 전체_직원정보를_조회한다(includeTerminated = false): Promise<Employee[]> {
        return this.employeeContext.전체_직원정보를_조회한다(includeTerminated);
    }

    async 모든_직원을_조회한다(includeTerminated = false): Promise<Employee[]> {
        return this.employeeContext.전체_직원정보를_조회한다(includeTerminated);
    }

    async 직원의_부서_직책_직급을_조회한다(
        employee: Employee,
    ): Promise<{ department: Department; position: Position; rank: Rank }> {
        return this.employeeContext.직원의_부서_직책_직급을_조회한다(employee);
    }

    async 여러_직원의_부서_직책_직급을_일괄조회한다(
        employees: Employee[],
    ): Promise<Map<string, { department: Department; position: Position; rank: Rank }>> {
        return this.employeeContext.여러_직원의_부서_직책_직급을_일괄조회한다(employees);
    }

    async 전체_직원상세정보를_조회한다(status?: EmployeeStatus): Promise<any[]> {
        return this.queryService.전체_직원상세정보를_조회한다(status);
    }

    // ==================== 직원 생성/수정/삭제 ====================

    async 연도별_다음직원번호를_조회한다(year: number) {
        return this.employeeContext.연도별_다음직원번호를_조회한다(year);
    }

    async 직원생성_전처리를_수행한다(name: string, englishLastName?: string, englishFirstName?: string) {
        return this.employeeContext.직원생성_전처리를_수행한다(name, englishLastName, englishFirstName);
    }

    async 고유한_이메일을_생성한다(englishLastName: string, englishFirstName: string): Promise<string> {
        return this.employeeContext.고유한_이메일을_생성한다(englishLastName, englishFirstName);
    }

    async 직원생성_컨텍스트_검증을_수행한다(data: {
        employeeNumber: string;
        email?: string;
        currentRankId?: string;
        departmentId?: string;
        positionId?: string;
    }): Promise<void> {
        return this.employeeContext.직원생성_컨텍스트_검증을_수행한다(data);
    }

    async 직원을_생성한다(
        data: {
            employeeNumber?: string;
            name: string;
            email?: string;
            englishLastName?: string;
            englishFirstName?: string;
            phoneNumber?: string;
            dateOfBirth?: Date;
            gender?: Gender;
            hireDate: Date;
            status?: EmployeeStatus;
            currentRankId?: string;
            departmentId?: string;
            positionId?: string;
            isManager?: boolean;
        },
        queryRunner?: QueryRunner,
    ) {
        return this.employeeContext.직원을_생성한다(data, queryRunner);
    }

    async 직원정보를_수정한다(
        employeeId: string,
        수정정보: {
            employeeNumber?: string;
            name?: string;
            email?: string;
            phoneNumber?: string;
            dateOfBirth?: Date;
            gender?: Gender;
            hireDate?: Date;
            status?: EmployeeStatus;
            currentRankId?: string;
            terminationDate?: Date;
            departmentId?: string;
            positionId?: string;
            isManager?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        return this.employeeContext.직원정보를_수정한다(employeeId, 수정정보, queryRunner);
    }

    async 직원을_삭제한다(employeeId: string, queryRunner?: QueryRunner): Promise<void> {
        return this.employeeContext.직원을_삭제한다(employeeId, queryRunner);
    }

    async 직원재직상태를_변경한다(
        employeeId: string,
        status: EmployeeStatus,
        terminationDate?: Date,
        terminationReason?: string,
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        return this.employeeContext.직원재직상태를_변경한다(employeeId, status, terminationDate, terminationReason, queryRunner);
    }

    async 직원을_퇴사처리한다(
        data: {
            employeeIdentifier: string;
            terminationDate: Date;
            terminationReason?: string;
            processedBy?: string;
        },
        queryRunner?: QueryRunner,
    ) {
        return this.employeeContext.직원을_퇴사처리한다(data, queryRunner);
    }

    async 직원의_직급을_변경한다(employeeId: string, newRankId: string, queryRunner?: QueryRunner) {
        return this.employeeContext.직원의_직급을_변경한다(employeeId, newRankId, queryRunner);
    }

    // ==================== 직원 일괄 수정 ====================

    async 직원_부서_일괄수정(employeeIds: string[], departmentId: string) {
        return this.employeeContext.직원_부서_일괄수정(employeeIds, departmentId);
    }

    async 직원_팀_일괄배치(employeeIds: string[], teamId: string) {
        return this.employeeContext.직원_팀_일괄배치(employeeIds, teamId);
    }

    async 직원_직책_일괄수정(employeeIds: string[], positionId: string) {
        return this.employeeContext.직원_직책_일괄수정(employeeIds, positionId);
    }

    async 직원_직급_일괄수정(employeeIds: string[], rankId: string) {
        return this.employeeContext.직원_직급_일괄수정(employeeIds, rankId);
    }

    async 직원_재직상태_일괄수정(employeeIds: string[], status: EmployeeStatus, terminationDate?: Date) {
        return this.employeeContext.직원_재직상태_일괄수정(employeeIds, status, terminationDate);
    }

    // ==================== 부서 관련 ====================

    async 부서_ID로_부서를_조회한다(departmentId: string): Promise<Department> {
        return this.departmentContext.부서_ID로_부서를_조회한다(departmentId);
    }

    async 부서_코드로_부서를_조회한다(departmentCode: string): Promise<Department> {
        return this.departmentContext.부서_코드로_부서를_조회한다(departmentCode);
    }

    async 모든_부서를_조회한다(): Promise<Department[]> {
        return this.departmentContext.모든_부서를_조회한다();
    }

    async 부서의_모든_하위부서들을_재귀적으로_조회한다(departmentId: string): Promise<Department[]> {
        return this.departmentContext.부서의_모든_하위부서들을_재귀적으로_조회한다(departmentId);
    }

    async 여러_부서를_일괄_수정한다(departmentIds: string[], updateData: Partial<Department>): Promise<void> {
        return this.departmentContext.여러_부서를_일괄_수정한다(departmentIds, updateData);
    }

    async 부서_계층구조를_조회한다(
        rootDepartmentId?: string,
        maxDepth?: number,
        includeEmptyDepartments = true,
        includeInactiveDepartments = false,
    ): Promise<Department[]> {
        return this.queryService.부서_계층구조를_조회한다(
            rootDepartmentId,
                maxDepth,
                includeEmptyDepartments,
                includeInactiveDepartments,
            );
    }

    async 부서별_직원_목록을_조회한다(departmentIds: string[], includeTerminated = false, withDetail = false) {
        return this.queryService.부서별_직원_목록을_조회한다(departmentIds, includeTerminated, withDetail);
    }

    async 부서_계층구조별_직원정보를_조회한다(
        rootDepartmentId?: string,
        maxDepth?: number,
        withEmployeeDetail = false,
        includeTerminated = false,
        includeEmptyDepartments = true,
        includeInactiveDepartments = false,
    ) {
        return this.queryService.부서_계층구조별_직원정보를_조회한다(
                rootDepartmentId,
                maxDepth,
            withEmployeeDetail,
            includeTerminated,
                includeEmptyDepartments,
                includeInactiveDepartments,
        );
    }

    async 부서를_생성한다(
        부서정보: {
        departmentName: string;
        departmentCode: string;
        type: any;
        parentDepartmentId?: string;
        order?: number;
        },
        queryRunner?: QueryRunner,
    ): Promise<Department> {
        return this.departmentContext.부서를_생성한다(부서정보, queryRunner);
    }

    async 부서를_수정한다(
        departmentId: string,
        수정정보: {
            departmentName?: string;
            departmentCode?: string;
            type?: any;
            parentDepartmentId?: string;
            isActive?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Department> {
        return this.departmentContext.부서를_수정한다(departmentId, 수정정보, queryRunner);
    }

    async 부서를_삭제한다(departmentId: string, queryRunner?: QueryRunner): Promise<void> {
        return this.departmentContext.부서를_삭제한다(departmentId, queryRunner);
    }

    async 부서순서를_변경한다(departmentId: string, newOrder: number, queryRunner?: QueryRunner): Promise<Department> {
        return this.departmentContext.부서순서를_변경한다(departmentId, newOrder, queryRunner);
    }

    // ==================== 직책 관련 ====================

    async 모든_직책을_조회한다(): Promise<Position[]> {
        return this.positionContext.모든_직책을_조회한다();
    }

    async 직책_ID로_직책을_조회한다(positionId: string): Promise<Position> {
        return this.positionContext.직책_ID로_직책을_조회한다(positionId);
    }

    async 가장_낮은_직책을_조회한다(): Promise<Position> {
        return this.positionContext.가장_낮은_직책을_조회한다();
    }

    async 직책을_생성한다(
        직책정보: {
        positionTitle: string;
        positionCode: string;
        level: number;
        hasManagementAuthority?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Position> {
        return this.positionContext.직책을_생성한다(직책정보, queryRunner);
    }

    async 직책을_수정한다(
        positionId: string,
        수정정보: {
            positionTitle?: string;
            positionCode?: string;
            level?: number;
            hasManagementAuthority?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Position> {
        return this.positionContext.직책을_수정한다(positionId, 수정정보, queryRunner);
    }

    async 직책을_삭제한다(positionId: string, queryRunner?: QueryRunner): Promise<void> {
        return this.positionContext.직책을_삭제한다(positionId, queryRunner);
    }

    // ==================== 직급 관련 ====================

    async 모든_직급을_조회한다(): Promise<Rank[]> {
        return this.rankContext.모든_직급을_조회한다();
    }

    async 직급_ID로_직급을_조회한다(rankId: string): Promise<Rank> {
        return this.rankContext.직급_ID로_직급을_조회한다(rankId);
    }

    async 직급을_생성한다(
        직급정보: { rankName: string; rankCode: string; level: number },
        queryRunner?: QueryRunner,
    ): Promise<Rank> {
        return this.rankContext.직급을_생성한다(직급정보, queryRunner);
    }

    async 직급을_수정한다(
        rankId: string,
        수정정보: {
            rankName?: string;
            rankCode?: string;
            level?: number;
        },
        queryRunner?: QueryRunner,
    ): Promise<Rank> {
        return this.rankContext.직급을_수정한다(rankId, 수정정보, queryRunner);
    }

    async 직급을_삭제한다(rankId: string, queryRunner?: QueryRunner): Promise<void> {
        return this.rankContext.직급을_삭제한다(rankId, queryRunner);
    }

    // ==================== 배치/이력 관련 ====================

    async 모든_직원부서직책매핑을_조회한다(): Promise<EmployeeDepartmentPosition[]> {
        return this.assignmentContext.모든_직원부서직책매핑을_조회한다();
    }

    async 배치_ID로_배치정보를_조회한다(assignmentId: string): Promise<EmployeeDepartmentPosition> {
        return this.assignmentContext.배치_ID로_배치정보를_조회한다(assignmentId);
    }

    async 직원의_모든_배치정보를_조회한다(employeeId: string): Promise<EmployeeDepartmentPosition[]> {
        return this.assignmentContext.직원의_모든_배치정보를_조회한다(employeeId);
    }

    async 전체_배치정보를_조회한다(): Promise<EmployeeDepartmentPosition[]> {
        return this.assignmentContext.전체_배치정보를_조회한다();
    }

    async 전체_배치상세정보를_조회한다(): Promise<
        Array<{
            assignment: EmployeeDepartmentPosition;
            employee: Employee;
            department: Department;
            position: Position;
            rank?: Rank;
        }>
    > {
        // 복잡한 조회는 아직 분리하지 않음 - 추후 Query Service로 이동 가능
        throw new Error('이 메서드는 아직 구현되지 않았습니다. Query Service로 이동 필요.');
    }

    async 직원을_부서에_배치한다(
        배치정보: {
        employeeId: string;
        departmentId: string;
        positionId: string;
        isManager?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPosition> {
        return this.assignmentContext.직원을_부서에_배치한다(배치정보, queryRunner);
    }

    async 직원배치정보를_수정한다(
        assignmentId: string,
        수정정보: {
            departmentId?: string;
            positionId?: string;
            isManager?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPosition> {
        return this.assignmentContext.직원배치정보를_수정한다(assignmentId, 수정정보, queryRunner);
    }

    async 직원배치를_해제한다(assignmentId: string, queryRunner?: QueryRunner): Promise<void> {
        return this.assignmentContext.직원배치를_해제한다(assignmentId, queryRunner);
    }

    async 직원배치_관리자상태를_변경한다(
        assignmentId: string,
        isManager: boolean,
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPosition> {
        return this.assignmentContext.직원배치_관리자상태를_변경한다(assignmentId, isManager, queryRunner);
    }

    async 직원의_직급이력을_조회한다(employeeId: string): Promise<EmployeeRankHistory[]> {
        return this.assignmentContext.직원의_직급이력을_조회한다(employeeId);
    }

    async 직급이력을_삭제한다(historyId: string): Promise<void> {
        return this.assignmentContext.직급이력을_삭제한다(historyId);
    }

    // ==================== 통계 및 분석 관련 ====================

    async 조직도_통계를_조회한다() {
        return this.queryService.조직도_통계를_조회한다();
    }

    async 전체_직원의_관리자_라인을_조회한다(includeTerminated = false) {
        return this.queryService.전체_직원의_관리자_라인을_조회한다(includeTerminated);
    }
}
