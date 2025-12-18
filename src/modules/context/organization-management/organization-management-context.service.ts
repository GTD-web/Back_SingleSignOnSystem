import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    DepartmentType,
    EmployeeDepartmentPositionHistory,
} from '../../../../libs/database/entities';
import { EmployeeStatus, Gender } from '../../../../libs/common/enums';
import { 직원생성ContextDto } from './dto/employee-create-context.dto';

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
    // 업데이트 완료 2025-12-11

    async 연도별_다음직원번호를_조회한다(year: number) {
        return this.employeeContext.연도별_다음직원번호를_조회한다(year);
    }

    async 직원을_생성한다(
        data: 직원생성ContextDto,
        executedBy?: string,
        queryRunner?: QueryRunner,
    ): Promise<{ employee: Employee; department: Department; position: Position }> {
        // 1. 전처리 (사번/이름/이메일 자동 생성)
        const {
            employeeNumber,
            name,
            email: generatedEmail,
        } = await this.employeeContext.직원생성_전처리를_수행한다(
            data.name,
            data.englishLastName,
            data.englishFirstName,
        );

        // data.employeeNumber = employeeNumber;
        data.email = generatedEmail || data.email;
        data.name = name;

        // 2. 컨텍스트 검증 (중복, 존재 확인)
        await this.employeeContext.직원생성_컨텍스트_검증을_수행한다({
            employeeNumber: data.employeeNumber,
            email: data.email,
            currentRankId: data.currentRankId,
            departmentId: data.departmentId,
            positionId: data.positionId,
        });

        const employee = await this.employeeContext.직원의_기본정보를_생성한다(
            {
                employeeNumber: data.employeeNumber,
                name: data.name,
                email: data.email,
                phoneNumber: data.phoneNumber,
                dateOfBirth: data.dateOfBirth,
                gender: data.gender,
                hireDate: data.hireDate,
                currentRankId: data.currentRankId,
            },
            queryRunner,
        );

        // 4. 배치 정보 완성도 확인 및 처리
        const shouldCreateAssignment = data.departmentId && data.positionId;
        let department: Department | undefined;
        let position: Position | undefined;
        if (shouldCreateAssignment) {
            const result = await this.assignmentContext.직원의_배치정보를_생성한다(
                {
                    employeeId: employee.id,
                    departmentId: data.departmentId,
                    positionId: data.positionId,
                    isManager: data.isManager,
                },
                executedBy,
                queryRunner,
            );
            department = result.department;
            position = result.position;
        }
        return { employee, department, position };
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
            currentRankId?: string;
            departmentId?: string;
            positionId?: string;
            isManager?: boolean;
        },
        executedBy?: string,
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        const updatedEmployee = await this.employeeContext.직원의_기본정보를_수정한다(
            employeeId,
            {
                employeeNumber: 수정정보.employeeNumber,
                name: 수정정보.name,
                email: 수정정보.email,
                phoneNumber: 수정정보.phoneNumber,
                dateOfBirth: 수정정보.dateOfBirth,
                gender: 수정정보.gender,
                hireDate: 수정정보.hireDate,
                currentRankId: 수정정보.currentRankId,
            },
            queryRunner,
        );

        const shouldCreateAssignment = 수정정보.departmentId || 수정정보.positionId || 수정정보.isManager;

        if (shouldCreateAssignment) {
            if (수정정보.departmentId) {
                const department = await this.departmentContext.부서_ID로_부서를_조회한다(수정정보.departmentId);
                if (department.type !== DepartmentType.DEPARTMENT && 수정정보.positionId) {
                    await this.assignmentContext.직원의_배치정보를_생성한다(
                        {
                            employeeId: employeeId,
                            departmentId: 수정정보.departmentId,
                            positionId: 수정정보.positionId,
                            isManager: 수정정보.isManager,
                        },
                        executedBy,
                        queryRunner,
                    );
                }
            }

            await this.assignmentContext.직원의_배치정보를_수정한다(
                employeeId,
                {
                    departmentId: 수정정보.departmentId,
                    positionId: 수정정보.positionId,
                    isManager: 수정정보.isManager,
                },
                executedBy,
                queryRunner,
            );
        }

        return updatedEmployee;
    }

    async 직원재직상태를_변경한다(
        employeeId: string,
        data: {
            status?: EmployeeStatus;
            terminationDate?: Date;
            terminationReason?: string;
        },
        executedBy?: string,
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        const updatedEmployee = await this.employeeContext.직원의_재직정보를_수정한다(employeeId, data, queryRunner);

        const assignmentData = {
            departmentId: null,
            positionId: null,
            isManager: null,
        };

        switch (data.status) {
            case EmployeeStatus.Terminated:
                const terminatedDepartment = await this.departmentContext.부서_코드로_부서를_조회한다('퇴사자');
                if (terminatedDepartment) {
                    assignmentData.departmentId = terminatedDepartment.id;
                }
                const defaultPosition = await this.positionContext.가장_낮은_직책을_조회한다();
                if (defaultPosition) {
                    assignmentData.positionId = defaultPosition.id;
                }
                assignmentData.isManager = false;
                break;

            case EmployeeStatus.Active:
            case EmployeeStatus.Leave:
                const recentAssignmentHistories = await this.assignmentContext.직원의_최근_배치이력을_조회한다(
                    updatedEmployee.id,
                );
                const currentAssignmentHistory = recentAssignmentHistories[0];
                const department = await this.departmentContext.부서_ID로_부서를_조회한다(
                    currentAssignmentHistory.departmentId,
                );
                let selectedAssignmentHistory;
                if (department.departmentCode === '퇴사자') {
                    selectedAssignmentHistory = recentAssignmentHistories[1];
                    assignmentData.departmentId = selectedAssignmentHistory.departmentId;
                    assignmentData.positionId = selectedAssignmentHistory.positionId;
                    assignmentData.isManager = selectedAssignmentHistory.isManager;
                }

                break;
        }

        if (assignmentData.departmentId && assignmentData.positionId) {
            await this.assignmentContext.직원의_배치정보를_수정한다(
                employeeId,
                assignmentData,
                executedBy,
                queryRunner,
            );
        }

        return updatedEmployee;
    }

    async 직원의_직급을_변경한다(employeeId: string, newRankId: string, queryRunner?: QueryRunner) {
        return this.employeeContext.직원의_직급을_변경한다(employeeId, newRankId, queryRunner);
    }

    async 직원을_삭제한다(employeeId: string, queryRunner?: QueryRunner): Promise<void> {
        return this.employeeContext.직원을_삭제한다(employeeId, queryRunner);
    }

    // ==================== 직원 일괄 수정 ====================

    /**
     * 직원 부서 일괄 수정
     */
    async 직원_부서_일괄수정(
        employeeIds: string[],
        departmentId: string,
    ): Promise<{
        successCount: number;
        failCount: number;
        successIds: string[];
        failIds: string[];
        errors: { employeeId: string; name?: string; message: string }[];
    }> {
        const department = await this.departmentContext.부서_ID로_부서를_조회한다(departmentId);

        if (department.type !== DepartmentType.DEPARTMENT) {
            throw new BadRequestException(`부서 타입이 DEPARTMENT가 아닙니다. 현재 타입: ${department.type}`);
        }

        const successIds: string[] = [];
        const failIds: string[] = [];
        const errors: { employeeId: string; name?: string; message: string }[] = [];

        for (const employeeId of employeeIds) {
            let employee: Employee | null = null;
            try {
                employee = await this.employeeContext.직원을_조회한다(employeeId);

                const existingAssignments = await this.assignmentContext.직원의_모든_배치정보를_조회한다(employeeId);
                let departmentAssignment = null;

                for (const assignment of existingAssignments) {
                    const dept = await this.departmentContext.부서_ID로_부서를_조회한다(assignment.departmentId);
                    if (dept.type === DepartmentType.DEPARTMENT) {
                        departmentAssignment = assignment;
                        break;
                    }
                }

                if (departmentAssignment) {
                    await this.assignmentContext.직원의_배치정보를_수정한다(
                        employeeId,
                        {
                            departmentId: departmentId,
                            positionId: departmentAssignment.positionId,
                            isManager: departmentAssignment.isManager,
                        },
                        undefined,
                        undefined,
                    );
                } else {
                    throw new Error('DEPARTMENT 타입의 기존 배치가 없습니다.');
                }

                successIds.push(employeeId);
            } catch (error) {
                failIds.push(employeeId);
                errors.push({
                    employeeId,
                    name: employee?.name,
                    message: error.message || '알 수 없는 오류',
                });
            }
        }

        return {
            successCount: successIds.length,
            failCount: failIds.length,
            successIds,
            failIds,
            errors,
        };
    }

    /**
     * 직원 팀 일괄 배치
     */
    async 직원_팀_일괄배치(
        employeeIds: string[],
        teamId: string,
    ): Promise<{
        successCount: number;
        failCount: number;
        successIds: string[];
        failIds: string[];
        errors: { employeeId: string; name?: string; message: string }[];
    }> {
        const team = await this.departmentContext.부서_ID로_부서를_조회한다(teamId);

        if (team.type !== DepartmentType.TEAM) {
            throw new BadRequestException(`부서 타입이 TEAM이 아닙니다. 현재 타입: ${team.type}`);
        }

        const allPositions = await this.positionContext.모든_직책을_조회한다();
        if (allPositions.length === 0) {
            throw new NotFoundException('시스템에 직책이 없습니다.');
        }
        const sortedPositions = [...allPositions].sort((a, b) => b.level - a.level);
        const defaultPositionId = sortedPositions[0].id;

        const successIds: string[] = [];
        const failIds: string[] = [];
        const errors: { employeeId: string; name?: string; message: string }[] = [];

        for (const employeeId of employeeIds) {
            let employee: Employee | null = null;
            try {
                employee = await this.employeeContext.직원을_조회한다(employeeId);

                const existingAssignments = await this.assignmentContext.직원의_모든_배치정보를_조회한다(employeeId);
                let teamAssignment = null;

                for (const assignment of existingAssignments) {
                    const department = await this.departmentContext.부서_ID로_부서를_조회한다(assignment.departmentId);
                    if (department.type === DepartmentType.TEAM && department.id === teamId) {
                        teamAssignment = assignment;
                        break;
                    }
                }

                if (teamAssignment) {
                    successIds.push(employeeId);
                } else {
                    await this.assignmentContext.직원의_배치정보를_생성한다(
                        {
                            employeeId: employee.id,
                            departmentId: teamId,
                            positionId: defaultPositionId,
                            isManager: false,
                        },
                        undefined,
                    );
                    successIds.push(employeeId);
                }
            } catch (error) {
                failIds.push(employeeId);
                errors.push({
                    employeeId,
                    name: employee?.name,
                    message: error.message || '알 수 없는 오류',
                });
            }
        }

        return {
            successCount: successIds.length,
            failCount: failIds.length,
            successIds,
            failIds,
            errors,
        };
    }

    /**
     * 직원 직책 일괄 수정
     */
    async 직원_직책_일괄수정(
        employeeIds: string[],
        positionId: string,
    ): Promise<{
        successCount: number;
        failCount: number;
        successIds: string[];
        failIds: string[];
        errors: { employeeId: string; name?: string; message: string }[];
    }> {
        await this.positionContext.직책_ID로_직책을_조회한다(positionId);

        const successIds: string[] = [];
        const failIds: string[] = [];
        const errors: { employeeId: string; name?: string; message: string }[] = [];

        for (const employeeId of employeeIds) {
            let employee: Employee | null = null;
            try {
                employee = await this.employeeContext.직원을_조회한다(employeeId);

                const existingAssignments = await this.assignmentContext.직원의_모든_배치정보를_조회한다(employeeId);
                let departmentAssignment = null;

                for (const assignment of existingAssignments) {
                    const department = await this.departmentContext.부서_ID로_부서를_조회한다(assignment.departmentId);
                    if (department.type === DepartmentType.DEPARTMENT) {
                        departmentAssignment = assignment;
                        break;
                    }
                }

                if (departmentAssignment) {
                    await this.assignmentContext.직원의_배치정보를_수정한다(
                        employeeId,
                        {
                            departmentId: departmentAssignment.departmentId,
                            positionId: positionId,
                            isManager: departmentAssignment.isManager,
                        },
                        undefined,
                        undefined,
                    );
                } else {
                    throw new Error('DEPARTMENT 타입의 기존 배치가 없습니다.');
                }

                successIds.push(employeeId);
            } catch (error) {
                failIds.push(employeeId);
                errors.push({
                    employeeId,
                    name: employee?.name,
                    message: error.message || '알 수 없는 오류',
                });
            }
        }

        return {
            successCount: successIds.length,
            failCount: failIds.length,
            successIds,
            failIds,
            errors,
        };
    }

    /**
     * 직원 직급 일괄 수정
     */
    async 직원_직급_일괄수정(
        employeeIds: string[],
        rankId: string,
    ): Promise<{
        successCount: number;
        failCount: number;
        successIds: string[];
        failIds: string[];
        errors: { employeeId: string; name?: string; message: string }[];
    }> {
        await this.rankContext.직급_ID로_직급을_조회한다(rankId);

        const successIds: string[] = [];
        const failIds: string[] = [];
        const errors: { employeeId: string; name?: string; message: string }[] = [];

        for (const employeeId of employeeIds) {
            let employee: Employee | null = null;
            try {
                employee = await this.employeeContext.직원을_조회한다(employeeId);

                await this.employeeContext.직원의_직급을_변경한다(employeeId, rankId);

                successIds.push(employeeId);
            } catch (error) {
                failIds.push(employeeId);
                errors.push({
                    employeeId,
                    name: employee?.name,
                    message: error.message || '알 수 없는 오류',
                });
            }
        }

        return {
            successCount: successIds.length,
            failCount: failIds.length,
            successIds,
            failIds,
            errors,
        };
    }

    /**
     * 직원 재직상태 일괄 수정
     */
    async 직원_재직상태_일괄수정(
        employeeIds: string[],
        status: EmployeeStatus,
        terminationDate?: Date,
    ): Promise<{
        successCount: number;
        failCount: number;
        successIds: string[];
        failIds: string[];
        errors: { employeeId: string; name?: string; message: string }[];
    }> {
        const successIds: string[] = [];
        const failIds: string[] = [];
        const errors: { employeeId: string; name?: string; message: string }[] = [];

        for (const employeeId of employeeIds) {
            let employee: Employee | null = null;
            try {
                employee = await this.employeeContext.직원을_조회한다(employeeId);

                await this.직원재직상태를_변경한다(
                    employeeId,
                    {
                        status,
                        terminationDate,
                    },
                    undefined,
                    undefined,
                );

                successIds.push(employeeId);
            } catch (error) {
                failIds.push(employeeId);
                errors.push({
                    employeeId,
                    name: employee?.name,
                    message: error.message || '알 수 없는 오류',
                });
            }
        }

        return {
            successCount: successIds.length,
            failCount: failIds.length,
            successIds,
            failIds,
            errors,
        };
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
        executedBy?: string,
        queryRunner?: QueryRunner,
    ): Promise<Department> {
        const department = await this.departmentContext.부서를_생성한다(부서정보, queryRunner);
        await this.departmentContext.부서정보의_변경이력을_생성한다(
            {
                departmentId: department.id,
                departmentName: department.departmentName,
                departmentCode: department.departmentCode,
                type: department.type,
                parentDepartmentId: department.parentDepartmentId,
                order: department.order,
                isActive: department.isActive,
                isException: department.isException,
                effectiveDate: new Date(),
                changeReason: '부서 생성',
                changedBy: executedBy,
            },
            queryRunner,
        );

        return department;
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
        executedBy?: string,
        queryRunner?: QueryRunner,
    ): Promise<Department> {
        const department = await this.departmentContext.부서를_수정한다(departmentId, 수정정보, queryRunner);

        const checkUpdate =
            수정정보.departmentName !== undefined ||
            수정정보.departmentCode !== undefined ||
            수정정보.type !== undefined ||
            수정정보.parentDepartmentId !== undefined;

        if (checkUpdate) {
            await this.departmentContext.부서정보의_변경이력을_생성한다(
                {
                    departmentId: department.id,
                    departmentName: department.departmentName,
                    departmentCode: department.departmentCode,
                    type: department.type,
                    parentDepartmentId: department.parentDepartmentId,
                    order: department.order,
                    isActive: department.isActive,
                    isException: department.isException,
                    effectiveDate: new Date(),
                    changeReason: '부서 수정',
                    changedBy: executedBy,
                },
                queryRunner,
            );
            if (수정정보.parentDepartmentId !== undefined) {
                const currentAssignment = await this.assignmentContext.부서의_현재배치이력을_조회한다(departmentId);
                if (currentAssignment && currentAssignment.length > 0) {
                    for (const assignment of currentAssignment) {
                        await this.assignmentContext.직원의_배치정보를_수정한다(
                            assignment.employeeId,
                            {
                                departmentId: departmentId,
                                positionId: assignment.positionId,
                                isManager: assignment.isManager,
                            },
                            executedBy,
                            queryRunner,
                        );
                    }
                }
            }
        }
        return department;
    }

    async 부서를_삭제한다(departmentId: string, executedBy?: string, queryRunner?: QueryRunner): Promise<void> {
        await this.departmentContext.부서이력을_종료한다(
            {
                departmentId: departmentId,
                effectiveDate: new Date(),
                changeReason: '부서 삭제',
                changedBy: executedBy,
            },
            queryRunner,
        );
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

    async 모든_배치이력을_조회한다(): Promise<EmployeeDepartmentPositionHistory[]> {
        return this.assignmentContext.모든_배치이력을_조회한다();
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
        return this.employeeContext.직원의_직급이력을_조회한다(employeeId);
    }

    async 직급이력을_삭제한다(historyId: string): Promise<void> {
        return this.employeeContext.직급이력을_삭제한다(historyId);
    }

    // ==================== 통계 및 분석 관련 ====================

    async 조직도_통계를_조회한다() {
        return this.queryService.조직도_통계를_조회한다();
    }

    async 전체_직원의_관리자_라인을_조회한다(includeTerminated = false) {
        return this.queryService.전체_직원의_관리자_라인을_조회한다(includeTerminated);
    }
}
