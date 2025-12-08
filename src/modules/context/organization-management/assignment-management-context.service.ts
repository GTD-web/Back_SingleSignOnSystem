import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainEmployeeDepartmentPositionService } from '../../domain/employee-department-position/employee-department-position.service';
import { DomainEmployeeRankHistoryService } from '../../domain/employee-rank-history/employee-rank-history.service';
import { EmployeeDepartmentPosition, EmployeeRankHistory } from '../../../../libs/database/entities';

/**
 * 배치/이력 관리 컨텍스트 서비스 (Command)
 * 직원 배치 및 직급 이력 관리
 */
@Injectable()
export class AssignmentManagementContextService {
    constructor(
        private readonly 직원부서직책서비스: DomainEmployeeDepartmentPositionService,
        private readonly 직원직급이력서비스: DomainEmployeeRankHistoryService,
    ) {}

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
        배치정보: {
            employeeId: string;
            departmentId: string;
            positionId: string;
            isManager?: boolean;
        },
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
        수정정보: {
            departmentId?: string;
            positionId?: string;
            isManager?: boolean;
        },
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

    // ==================== 직급 이력 ====================

    /**
     * 직원의 직급이력을 조회한다
     */
    async 직원의_직급이력을_조회한다(employeeId: string): Promise<EmployeeRankHistory[]> {
        return this.직원직급이력서비스.findByEmployeeId(employeeId);
    }

    /**
     * 직급이력을 삭제한다
     */
    async 직급이력을_삭제한다(historyId: string): Promise<void> {
        await this.직원직급이력서비스.deleteHistory(historyId);
    }
}

