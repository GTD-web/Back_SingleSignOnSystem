import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withTransaction } from '../../../../../../libs/common/utils/transaction.util';
import {
    AssignEmployeeRequestDto,
    UpdateEmployeeAssignmentRequestDto,
    UpdateManagerStatusRequestDto,
    EmployeeAssignmentResponseDto,
    EmployeeAssignmentDetailResponseDto,
} from '../dto';
import { OrganizationManagementContextService } from '../../../../context/organization-management/organization-management-context.service';

/**
 * 배치 관리 Business Service
 * - 트랜잭션 관리
 * - DTO 변환
 * - Context 조율
 */
@Injectable()
export class AssignmentApplicationService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly organizationContext: OrganizationManagementContextService,
    ) {}

    // ==================== 조회 (트랜잭션 불필요) ====================

    async 전체배치목록조회(): Promise<EmployeeAssignmentDetailResponseDto[]> {
        const assignmentsWithDetails = await this.organizationContext.전체_배치상세정보를_조회한다();
        return assignmentsWithDetails.map(this.직원배치상세를_응답DTO로_변환한다);
    }

    async 직원배치현황조회(employeeId: string): Promise<EmployeeAssignmentResponseDto[]> {
        const assignments = await this.organizationContext.직원의_모든_배치정보를_조회한다(employeeId);
        return assignments.map(this.직원배치를_응답DTO로_변환한다);
    }

    // ==================== 명령 (트랜잭션 필요) ====================

    async 직원배치(
        assignEmployeeDto: AssignEmployeeRequestDto,
        executedBy?: string,
    ): Promise<EmployeeAssignmentResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const assignment = await this.organizationContext.직원을_부서에_배치한다(assignEmployeeDto, queryRunner);

            return this.직원배치를_응답DTO로_변환한다(assignment);
        });
    }

    async 직원배치변경(
        id: string,
        updateAssignmentDto: UpdateEmployeeAssignmentRequestDto,
        executedBy?: string,
    ): Promise<EmployeeAssignmentResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const updatedAssignment = await this.organizationContext.직원배치정보를_수정한다(
                id,
                updateAssignmentDto,
                queryRunner,
            );

            return this.직원배치를_응답DTO로_변환한다(updatedAssignment);
        });
    }

    async 직원배치해제(id: string, executedBy?: string): Promise<void> {
        await withTransaction(this.dataSource, async (queryRunner) => {
            // 배치 해제 전 배치 정보 조회 (이력 기록용)
            const assignment = await this.organizationContext.배치_ID로_배치정보를_조회한다(id);

            await this.organizationContext.직원배치를_해제한다(id, queryRunner);
        });
    }

    async 직원배치_관리자상태변경(
        id: string,
        updateManagerStatusDto: UpdateManagerStatusRequestDto,
        executedBy?: string,
    ): Promise<EmployeeAssignmentResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const updatedAssignment = await this.organizationContext.직원배치_관리자상태를_변경한다(
                id,
                updateManagerStatusDto.isManager,
                queryRunner,
            );

            return this.직원배치를_응답DTO로_변환한다(updatedAssignment);
        });
    }

    // ==================== DTO 변환 ====================

    private 직원배치를_응답DTO로_변환한다 = (assignment: any): EmployeeAssignmentResponseDto => ({
        id: assignment.id,
        employeeId: assignment.employeeId,
        departmentId: assignment.departmentId,
        positionId: assignment.positionId,
        isManager: assignment.isManager,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
    });

    private 직원배치상세를_응답DTO로_변환한다 = (data: {
        assignment: any;
        employee: any;
        department: any;
        position: any;
        rank?: any;
    }): EmployeeAssignmentDetailResponseDto => ({
        id: data.assignment.id,
        employeeId: data.assignment.employeeId,
        employeeNumber: data.employee?.employeeNumber || '',
        employeeName: data.employee?.name || '',
        departmentId: data.assignment.departmentId,
        departmentName: data.department?.departmentName || '',
        departmentCode: data.department?.departmentCode || '',
        positionId: data.assignment.positionId,
        positionTitle: data.position?.positionTitle || '',
        positionCode: data.position?.positionCode || '',
        rankId: data.rank?.id,
        rankName: data.rank?.rankName,
        rankCode: data.rank?.rankCode,
        isManager: data.assignment.isManager,
        createdAt: data.assignment.createdAt,
        updatedAt: data.assignment.updatedAt,
    });
}
