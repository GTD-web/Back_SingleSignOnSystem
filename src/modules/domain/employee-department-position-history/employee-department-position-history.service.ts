import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { BaseService } from '../../../../libs/common/services/base.service';
import { EmployeeDepartmentPositionHistory } from './employee-department-position-history.entity';
import { DomainEmployeeDepartmentPositionHistoryRepository } from './employee-department-position-history.repository';

@Injectable()
export class DomainEmployeeDepartmentPositionHistoryService extends BaseService<EmployeeDepartmentPositionHistory> {
    constructor(private readonly historyRepository: DomainEmployeeDepartmentPositionHistoryRepository) {
        super(historyRepository);
    }

    /**
     * 직원 발령 이력을 생성한다 (Setter 함수 활용)
     */
    async 직원발령이력을생성한다(
        params: {
            employeeId: string;
            departmentId: string;
            positionId: string;
            rankId?: string;
            isManager: boolean;
            effectiveStartDate: string;
            assignmentReason?: string;
            assignedBy?: string;
        },
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPositionHistory> {
        const newAssignment = new EmployeeDepartmentPositionHistory();

        // 기본 정보
        newAssignment.employeeId = params.employeeId;
        newAssignment.부서를설정한다(params.departmentId);
        newAssignment.직책을설정한다(params.positionId);

        if (params.rankId) {
            newAssignment.직급을설정한다(params.rankId);
        }

        newAssignment.관리자권한을설정한다(params.isManager);

        // 유효 기간
        newAssignment.effectiveStartDate = params.effectiveStartDate;
        newAssignment.현재유효상태로설정한다();

        // 발령 메타데이터
        if (params.assignmentReason) {
            newAssignment.발령사유를설정한다(params.assignmentReason);
        }

        if (params.assignedBy) {
            newAssignment.발령자를설정한다(params.assignedBy);
        }

        return await this.save(newAssignment, { queryRunner });
    }

    /**
     * 직원 발령 이력의 종료일을 설정한다 (Setter 함수 활용)
     */
    async 이력을종료한다(
        history: EmployeeDepartmentPositionHistory,
        effectiveEndDate: string,
        queryRunner?: QueryRunner,
    ): Promise<EmployeeDepartmentPositionHistory> {
        // Setter 함수로 종료일 설정 (isCurrent도 함께 false로 변경)
        history.유효종료일을설정한다(effectiveEndDate);

        // 저장
        return await this.save(history, { queryRunner });
    }

    /**
     * 특정 시점의 직원 배치 정보를 조회한다
     */
    async findByEmployeeAtDate(
        employeeId: string,
        targetDate: string,
    ): Promise<EmployeeDepartmentPositionHistory | null> {
        return this.historyRepository
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.department', 'dept')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.employeeId = :employeeId', { employeeId })
            .andWhere('eh.effectiveStartDate <= :targetDate', { targetDate })
            .andWhere('(eh.effectiveEndDate IS NULL OR eh.effectiveEndDate > :targetDate)', { targetDate })
            .getOne();
    }

    /**
     * 현재 유효한 직원 배치를 조회한다
     */
    async findCurrentByEmployeeId(employeeId: string): Promise<EmployeeDepartmentPositionHistory | null> {
        return this.historyRepository
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.department', 'dept')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.employeeId = :employeeId', { employeeId })
            .andWhere('eh.isCurrent = :isCurrent', { isCurrent: true })
            .getOne();
    }

    /**
     * 직원의 모든 배치 이력을 조회한다
     */
    async findHistoryByEmployeeId(employeeId: string): Promise<EmployeeDepartmentPositionHistory[]> {
        return this.historyRepository
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.department', 'dept')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.employeeId = :employeeId', { employeeId })
            .orderBy('eh.effectiveStartDate', 'DESC')
            .getMany();
    }

    /**
     * 특정 부서의 특정 시점 배치 목록을 조회한다
     */
    async findByDepartmentAtDate(
        departmentId: string,
        targetDate: string,
    ): Promise<EmployeeDepartmentPositionHistory[]> {
        return this.historyRepository
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.employee', 'emp')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.departmentId = :departmentId', { departmentId })
            .andWhere('eh.effectiveStartDate <= :targetDate', { targetDate })
            .andWhere('(eh.effectiveEndDate IS NULL OR eh.effectiveEndDate > :targetDate)', { targetDate })
            .getMany();
    }

    /**
     * 현재 유효한 모든 직원 배치를 조회한다
     */
    async findAllCurrent(): Promise<EmployeeDepartmentPositionHistory[]> {
        return this.historyRepository
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.employee', 'emp')
            .leftJoinAndSelect('eh.department', 'dept')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.isCurrent = :isCurrent', { isCurrent: true })
            .getMany();
    }
}
