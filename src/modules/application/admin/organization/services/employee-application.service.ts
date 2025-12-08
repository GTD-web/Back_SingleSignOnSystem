import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withTransaction } from '../../../../../../libs/common/utils/transaction.util';
import {
    CreateEmployeeRequestDto,
    UpdateEmployeeRequestDto,
    AdminEmployeeResponseDto,
    NextEmployeeNumberResponseDto,
    EmployeeDetailInfoDto,
    EmployeeDetailListResponseDto,
    PromoteEmployeeRequestDto,
    EmployeeRankHistoryResponseDto,
    EmployeeAssignmentDetailDto,
    BulkUpdateResultDto,
} from '../dto';
import { OrganizationManagementContextService } from '../../../../context/organization-management/organization-management-context.service';
import { SystemManagementContextService } from '../../../../context/system-management/system-management-context.service';
import { DepartmentType } from '../../../../domain/department/department.entity';
import { Employee } from '../../../../domain/employee/employee.entity';
import { EmployeeStatus } from '../../../../../../libs/common/enums';

/**
 * 직원 관리 Business Service
 * - 트랜잭션 관리
 * - DTO 변환
 * - Context 조율
 */
@Injectable()
export class EmployeeApplicationService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly organizationContext: OrganizationManagementContextService,
        private readonly systemContext: SystemManagementContextService,
    ) {}

    // ==================== 조회 (트랜잭션 불필요) ====================

    async 직원상세목록조회(status?: EmployeeStatus): Promise<EmployeeDetailListResponseDto> {
        const employeesWithDetails = await this.organizationContext.전체_직원상세정보를_조회한다(status);
        return {
            employees: employeesWithDetails.map(this.직원상세정보를_응답DTO로_변환한다),
        };
    }

    async 다음직원번호조회(year: number): Promise<NextEmployeeNumberResponseDto> {
        return await this.organizationContext.연도별_다음직원번호를_조회한다(year);
    }

    async 직원상세조회(id: string): Promise<AdminEmployeeResponseDto> {
        const employee = await this.organizationContext.직원을_조회한다(id);
        const baseDto = this.직원을_응답DTO로_변환한다(employee);

        // 배치 정보 조회 및 매핑
        const assignments = await this.organizationContext.직원의_모든_배치정보를_조회한다(id);

        if (assignments.length > 0) {
            const departmentIds = [...new Set(assignments.map((a) => a.departmentId))];
            const positionIds = [...new Set(assignments.map((a) => a.positionId))];

            const [departments, positions] = await Promise.all([
                Promise.all(departmentIds.map((deptId) => this.organizationContext.부서_ID로_부서를_조회한다(deptId))),
                Promise.all(positionIds.map((posId) => this.organizationContext.직책_ID로_직책을_조회한다(posId))),
            ]);

            const departmentMap = new Map(departments.map((dept) => [dept.id, dept]));
            const positionMap = new Map(positions.map((pos) => [pos.id, pos]));

            const departmentAssignment = assignments.find((assignment) => {
                const dept = departmentMap.get(assignment.departmentId);
                return dept?.type === DepartmentType.DEPARTMENT;
            });

            const teamAssignments = assignments.filter((assignment) => {
                const dept = departmentMap.get(assignment.departmentId);
                return dept?.type === DepartmentType.TEAM;
            });

            if (departmentAssignment) {
                const dept = departmentMap.get(departmentAssignment.departmentId);
                const pos = positionMap.get(departmentAssignment.positionId);
                if (dept && pos) {
                    baseDto.department = {
                        id: departmentAssignment.id,
                        departmentId: dept.id,
                        departmentName: dept.departmentName,
                        departmentCode: dept.departmentCode,
                        departmentType: dept.type,
                        positionId: pos.id,
                        positionTitle: pos.positionTitle,
                        positionCode: pos.positionCode,
                        isManager: departmentAssignment.isManager,
                        createdAt: departmentAssignment.createdAt,
                        updatedAt: departmentAssignment.updatedAt,
                    };
                }
            }

            if (teamAssignments.length > 0) {
                baseDto.teams = teamAssignments
                    .map((assignment) => {
                        const dept = departmentMap.get(assignment.departmentId);
                        const pos = positionMap.get(assignment.positionId);
                        if (dept && pos) {
                            return {
                                id: assignment.id,
                                departmentId: dept.id,
                                departmentName: dept.departmentName,
                                departmentCode: dept.departmentCode,
                                departmentType: dept.type,
                                positionId: pos.id,
                                positionTitle: pos.positionTitle,
                                positionCode: pos.positionCode,
                                isManager: assignment.isManager,
                                createdAt: assignment.createdAt,
                                updatedAt: assignment.updatedAt,
                            };
                        }
                        return null;
                    })
                    .filter((team) => team !== null) as EmployeeAssignmentDetailDto[];
            }
        }

        return baseDto;
    }

    async 직원직급이력조회(employeeId: string): Promise<EmployeeRankHistoryResponseDto[]> {
        const histories = await this.organizationContext.직원의_직급이력을_조회한다(employeeId);
        return histories.map(this.직급이력을_응답DTO로_변환한다);
    }

    // ==================== 명령 (트랜잭션 필요) ====================

    async 직원생성(createEmployeeDto: CreateEmployeeRequestDto): Promise<AdminEmployeeResponseDto> {
        const result = await withTransaction(this.dataSource, async (queryRunner) => {
            return await this.organizationContext.직원을_생성한다(
                {
                    employeeNumber: createEmployeeDto.employeeNumber,
                    name: createEmployeeDto.name,
                    email: createEmployeeDto.email,
                    phoneNumber: createEmployeeDto.phoneNumber,
                    dateOfBirth: createEmployeeDto.dateOfBirth ? new Date(createEmployeeDto.dateOfBirth) : undefined,
                    gender: createEmployeeDto.gender,
                    hireDate: new Date(createEmployeeDto.hireDate),
                    currentRankId: createEmployeeDto.currentRankId,
                    departmentId: createEmployeeDto.departmentId,
                    positionId: createEmployeeDto.positionId,
                    isManager: createEmployeeDto.isManager,
                },
                queryRunner,
            );
        });

        // 직원 생성 후 기본 역할 자동 할당 (트랜잭션 외부에서 처리 - 실패해도 직원 생성은 유지)
        try {
            await this.systemContext.직원에게_기본역할들을_할당한다(result.employee.id);
        } catch (error) {
            console.error('직원 생성 후 기본 역할 할당 실패:', error);
        }

        return this.직원을_응답DTO로_변환한다(result.employee);
    }

    async 직원수정(id: string, updateEmployeeDto: UpdateEmployeeRequestDto): Promise<AdminEmployeeResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            let employee: Employee;

            const hasOtherUpdates =
                updateEmployeeDto.employeeNumber !== undefined ||
                updateEmployeeDto.name !== undefined ||
                updateEmployeeDto.email !== undefined ||
                updateEmployeeDto.phoneNumber !== undefined ||
                updateEmployeeDto.dateOfBirth !== undefined ||
                updateEmployeeDto.gender !== undefined ||
                updateEmployeeDto.hireDate !== undefined ||
                updateEmployeeDto.currentRankId !== undefined ||
                updateEmployeeDto.departmentId !== undefined ||
                updateEmployeeDto.positionId !== undefined ||
                updateEmployeeDto.isManager !== undefined;

            // 다른 정보 먼저 수정
            if (hasOtherUpdates) {
                employee = await this.organizationContext.직원정보를_수정한다(
                    id,
                    {
                        employeeNumber: updateEmployeeDto.employeeNumber,
                        name: updateEmployeeDto.name,
                        email: updateEmployeeDto.email,
                        phoneNumber: updateEmployeeDto.phoneNumber,
                        dateOfBirth: updateEmployeeDto.dateOfBirth
                            ? new Date(updateEmployeeDto.dateOfBirth)
                            : undefined,
                        gender: updateEmployeeDto.gender,
                        hireDate: updateEmployeeDto.hireDate ? new Date(updateEmployeeDto.hireDate) : undefined,
                        currentRankId: updateEmployeeDto.currentRankId,
                        departmentId: updateEmployeeDto.departmentId,
                        positionId: updateEmployeeDto.positionId,
                        isManager: updateEmployeeDto.isManager,
                    },
                    queryRunner,
                );
            }

            // 재직상태 변경
            if (updateEmployeeDto.status !== undefined) {
                employee = await this.organizationContext.직원재직상태를_변경한다(
                    id,
                    updateEmployeeDto.status,
                    updateEmployeeDto.terminationDate ? new Date(updateEmployeeDto.terminationDate) : undefined,
                    undefined,
                    queryRunner,
                );
            }

            if (!employee) {
                employee = await this.organizationContext.직원을_조회한다(id);
            }

            return this.직원을_응답DTO로_변환한다(employee);
        });
    }

    async 직원삭제(id: string): Promise<void> {
        await withTransaction(this.dataSource, async (queryRunner) => {
            await this.organizationContext.직원을_삭제한다(id, queryRunner);
        });
    }

    async 직원직급변경(
        employeeId: string,
        promoteDto: PromoteEmployeeRequestDto,
    ): Promise<EmployeeRankHistoryResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const { rankHistory } = await this.organizationContext.직원의_직급을_변경한다(
                employeeId,
                promoteDto.rankId,
                queryRunner,
            );
            return this.직급이력을_응답DTO로_변환한다(rankHistory);
        });
    }

    // ==================== 일괄 수정 ====================

    async 직원부서일괄수정(employeeIds: string[], departmentId: string): Promise<BulkUpdateResultDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            // TODO: 일괄 수정은 복잡한 로직이므로 나중에 queryRunner 전달
            return await this.organizationContext.직원_부서_일괄수정(employeeIds, departmentId);
        });
    }

    async 직원팀일괄배치(employeeIds: string[], teamId: string): Promise<BulkUpdateResultDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            // TODO: 일괄 수정은 복잡한 로직이므로 나중에 queryRunner 전달
            return await this.organizationContext.직원_팀_일괄배치(employeeIds, teamId);
        });
    }

    async 직원직책일괄수정(employeeIds: string[], positionId: string): Promise<BulkUpdateResultDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            // TODO: 일괄 수정은 복잡한 로직이므로 나중에 queryRunner 전달
            return await this.organizationContext.직원_직책_일괄수정(employeeIds, positionId);
        });
    }

    async 직원직급일괄수정(employeeIds: string[], rankId: string): Promise<BulkUpdateResultDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            // TODO: 일괄 수정은 복잡한 로직이므로 나중에 queryRunner 전달
            return await this.organizationContext.직원_직급_일괄수정(employeeIds, rankId);
        });
    }

    async 직원재직상태일괄수정(
        employeeIds: string[],
        status: EmployeeStatus,
        terminationDate?: Date,
    ): Promise<BulkUpdateResultDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            // TODO: 일괄 수정은 복잡한 로직이므로 나중에 queryRunner 전달
            return await this.organizationContext.직원_재직상태_일괄수정(employeeIds, status, terminationDate);
        });
    }

    // ==================== DTO 변환 ====================

    private 직원을_응답DTO로_변환한다 = (employee: any): AdminEmployeeResponseDto => ({
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: employee.name,
        email: employee.email,
        phoneNumber: employee.phoneNumber,
        dateOfBirth: employee.dateOfBirth,
        gender: employee.gender,
        hireDate: employee.hireDate,
        status: employee.status,
        currentRankId: employee.currentRankId,
        terminationDate: employee.terminationDate,
        metadata: employee.metadata,
        isInitialPasswordSet: employee.isInitialPasswordSet,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
    });

    private 직급이력을_응답DTO로_변환한다 = (history: any): EmployeeRankHistoryResponseDto => ({
        id: history.id,
        employeeId: history.employeeId,
        rankId: history.rankId,
        createdAt: history.createdAt,
        updatedAt: history.updatedAt,
    });

    private 직원상세정보를_응답DTO로_변환한다 = (employeeWithDetails: any): EmployeeDetailInfoDto => ({
        id: employeeWithDetails.id,
        employeeNumber: employeeWithDetails.employeeNumber,
        name: employeeWithDetails.name,
        email: employeeWithDetails.email,
        phoneNumber: employeeWithDetails.phoneNumber,
        dateOfBirth: employeeWithDetails.dateOfBirth,
        gender: employeeWithDetails.gender,
        hireDate: employeeWithDetails.hireDate,
        status: employeeWithDetails.status,
        currentRankId: employeeWithDetails.currentRankId,
        terminationDate: employeeWithDetails.terminationDate,
        metadata: employeeWithDetails.metadata,
        isInitialPasswordSet: employeeWithDetails.isInitialPasswordSet,
        createdAt: employeeWithDetails.createdAt,
        updatedAt: employeeWithDetails.updatedAt,
        departments: employeeWithDetails.departments,
        rank: employeeWithDetails.rank,
        tokens: employeeWithDetails.tokens,
        fcmTokens: employeeWithDetails.fcmTokens,
        systemRoles: employeeWithDetails.systemRoles,
    });
}
