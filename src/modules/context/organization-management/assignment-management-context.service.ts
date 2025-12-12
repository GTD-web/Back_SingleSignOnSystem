import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainEmployeeDepartmentPositionService } from '../../domain/employee-department-position/employee-department-position.service';
import { DomainEmployeeRankHistoryService } from '../../domain/employee-rank-history/employee-rank-history.service';
import {
    Department,
    DepartmentType,
    Position,
    EmployeeDepartmentPosition,
    EmployeeRankHistory,
} from '../../../../libs/database/entities';
import { DomainEmployeeDepartmentPositionHistoryService } from '../../domain/employee-department-position-history/employee-department-position-history.service';
import { EmployeeDepartmentPositionHistory } from '../../domain/employee-department-position-history/employee-department-position-history.entity';
import { 직원배치생성ContextDto, 직원배치이력생성ContextDto, 직원배치수정ContextDto } from './dto';
import { DomainDepartmentService } from '../../domain/department/department.service';
import { DomainPositionService } from '../../domain/position/position.service';
/**
 * 배치/이력 관리 컨텍스트 서비스 (Command)
 * 직원 배치 및 직급 이력 관리
 */
@Injectable()
export class AssignmentManagementContextService {
    constructor(
        private readonly 부서서비스: DomainDepartmentService,
        private readonly 직책서비스: DomainPositionService,
        private readonly 직원부서직책서비스: DomainEmployeeDepartmentPositionService,
        private readonly 직원직급이력서비스: DomainEmployeeRankHistoryService,
        private readonly 직원발령이력서비스: DomainEmployeeDepartmentPositionHistoryService,
    ) {}

    /**
     * Date를 YYYY-MM-DD 형식으로 변환한다
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 날짜에서 하루를 뺀다
     */
    private subtractDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result;
    }

    async 직원의_배치정보를_생성한다(
        data: 직원배치생성ContextDto,
        executedBy?: string,
        queryRunner?: QueryRunner,
    ): Promise<{ department: Department; position: Position }> {
        await this.직원부서직책서비스.배치를생성한다(
            {
                employeeId: data.employeeId,
                departmentId: data.departmentId,
                positionId: data.positionId,
                isManager: data.isManager,
            },
            queryRunner,
        );

        const department = await this.부서서비스.findById(data.departmentId);
        const position = await this.직책서비스.findById(data.positionId);

        if (department && department.type === DepartmentType.DEPARTMENT) {
            await this.직원의_배치이력을_생성한다(
                {
                    employeeId: data.employeeId,
                    departmentId: data.departmentId,
                    positionId: data.positionId,
                    isManager: data.isManager,
                    effectiveDate: new Date(),
                    assignmentReason: '직원 입사',
                    assignedBy: executedBy,
                },
                queryRunner,
            );
        }

        return { department, position };
    }

    async 직원의_배치이력을_생성한다(
        dto: 직원배치이력생성ContextDto,
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPositionHistory> {
        const newStartDate = dto.effectiveDate;
        const previousEndDate = this.formatDate(this.subtractDays(newStartDate, 1));

        // 1. 현재 발령 정보 조회 (한 번만 조회)
        const currentAssignment = await this.직원발령이력서비스.findCurrentByEmployeeId(dto.employeeId);

        // 2. 기존 이력이 있으면 종료 처리 (조회한 Entity 재사용)
        if (currentAssignment) {
            await this.직원발령이력서비스.이력을종료한다(currentAssignment, previousEndDate, queryRunner);
        }

        // 3. Domain Service를 통해 새 배치 이력 생성
        const savedAssignment = await this.직원발령이력서비스.직원발령이력을생성한다(
            {
                employeeId: dto.employeeId,
                departmentId: dto.departmentId,
                positionId: dto.positionId,
                isManager: dto.isManager,
                effectiveStartDate: this.formatDate(newStartDate),
                assignmentReason: dto.assignmentReason,
                assignedBy: dto.assignedBy,
            },
            queryRunner,
        );

        return savedAssignment;
    }

    async 직원의_배치정보를_수정한다(
        employeeId: string,
        수정정보: 직원배치수정ContextDto,
        executedBy?: string,
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPosition> {
        const assignment = await this.직원부서직책서비스.findByEmployeeId(employeeId);
        if (!assignment) {
            throw new Error('배치 정보를 찾을 수 없습니다.');
        }
        const updatedAssignment = await this.직원부서직책서비스.배치를수정한다(assignment, 수정정보, queryRunner);

        await this.직원의_배치이력을_생성한다(
            {
                employeeId: employeeId,
                departmentId: updatedAssignment.departmentId,
                positionId: updatedAssignment.positionId,
                isManager: updatedAssignment.isManager,
                effectiveDate: new Date(),
                assignmentReason: '직원 배치 수정',
                assignedBy: executedBy,
            },
            queryRunner,
        );
        return;
    }

    async 직원의_배치정보를_해제한다(employeeId: string, queryRunner?: QueryRunner): Promise<void> {
        const assignment = await this.직원부서직책서비스.findByEmployeeId(employeeId);
        if (!assignment) {
            throw new Error('배치 정보를 찾을 수 없습니다.');
        }
        await this.직원부서직책서비스.deleteAssignment(assignment.id, queryRunner);

        const currentAssignment = await this.직원발령이력서비스.findCurrentByEmployeeId(employeeId);
        if (!currentAssignment) {
            throw new Error('배치 정보 이력을 찾을 수 없습니다.');
        }
        await this.직원발령이력서비스.이력을종료한다(currentAssignment, this.formatDate(new Date()), queryRunner);
    }

    async 직원의_최근_배치이력을_조회한다(employeeId: string): Promise<EmployeeDepartmentPositionHistory[]> {
        const recentAssignmentHistories = await this.직원발령이력서비스.findAll({
            where: { employeeId },
            order: { effectiveStartDate: 'DESC' },
            take: 2,
        });

        if (recentAssignmentHistories.length === 0) {
            throw new Error('배치 정보 이력을 찾을 수 없습니다.');
        }
        return recentAssignmentHistories;
    }

    // =================================================================== 구분선 ==========================================
    // ==================== 배치 조회 ====================

    /**
     * 모든 직원 부서 직책 매핑을 조회한다
     */
    async 모든_직원부서직책매핑을_조회한다(): Promise<EmployeeDepartmentPosition[]> {
        return this.직원부서직책서비스.findAll();
    }

    /**
     * 배치 ID로 배치정보를 조회한다
     */
    async 배치_ID로_배치정보를_조회한다(assignmentId: string): Promise<EmployeeDepartmentPosition> {
        return this.직원부서직책서비스.findById(assignmentId);
    }

    /**
     * 직원의 모든 배치정보를 조회한다
     */
    async 직원의_모든_배치정보를_조회한다(employeeId: string): Promise<EmployeeDepartmentPosition[]> {
        return this.직원부서직책서비스.findAllByEmployeeId(employeeId);
    }

    /**
     * 전체 배치정보를 조회한다
     */
    async 전체_배치정보를_조회한다(): Promise<EmployeeDepartmentPosition[]> {
        return this.직원부서직책서비스.findAllAssignments();
    }

    // ==================== 배치 CRUD ====================

    /**
     * 직원을 부서에 배치한다
     */
    async 직원을_부서에_배치한다(
        배치정보: 직원배치생성ContextDto,
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPosition> {
        // 이미 해당 부서에 배치되어 있는지 확인
        try {
            const existingAssignment = await this.직원부서직책서비스.findByEmployeeAndDepartment(
                배치정보.employeeId,
                배치정보.departmentId,
            );
            throw new Error('이미 해당 부서에 배치되어 있습니다.');
        } catch (error) {
            // NotFoundException인 경우 - 배치가 없으므로 정상적으로 진행
            if (error instanceof NotFoundException) {
                // 배치가 없으므로 새로 생성 가능
            } else {
                // 다른 시스템 에러는 그대로 전파
                throw error;
            }
        }

        // Domain Service를 통해 배치 생성
        return await this.직원부서직책서비스.배치를생성한다(
            {
                employeeId: 배치정보.employeeId,
                departmentId: 배치정보.departmentId,
                positionId: 배치정보.positionId,
                isManager: 배치정보.isManager || false,
            },
            queryRunner,
        );
    }

    /**
     * 직원배치정보를 수정한다
     */
    async 직원배치정보를_수정한다(
        assignmentId: string,
        수정정보: 직원배치수정ContextDto,
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPosition> {
        const assignment = await this.직원부서직책서비스.findById(assignmentId);
        return await this.직원부서직책서비스.배치를수정한다(assignment, 수정정보, queryRunner);
    }

    /**
     * 직원배치를 해제한다
     */
    async 직원배치를_해제한다(assignmentId: string, queryRunner?: QueryRunner): Promise<void> {
        await this.직원부서직책서비스.deleteAssignment(assignmentId);
    }

    /**
     * 직원배치 관리자상태를 변경한다
     */
    async 직원배치_관리자상태를_변경한다(
        assignmentId: string,
        isManager: boolean,
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPosition> {
        const assignment = await this.배치_ID로_배치정보를_조회한다(assignmentId);
        if (!assignment) {
            throw new Error('배치 정보를 찾을 수 없습니다.');
        }

        return await this.직원부서직책서비스.배치를수정한다(assignment, { isManager }, queryRunner);
    }
}
