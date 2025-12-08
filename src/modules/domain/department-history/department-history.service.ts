import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { BaseService } from '../../../../libs/common/services/base.service';
import { DepartmentHistory } from './department-history.entity';
import { DomainDepartmentHistoryRepository } from './department-history.repository';
import { DepartmentType } from '../department/department.entity';

@Injectable()
export class DomainDepartmentHistoryService extends BaseService<DepartmentHistory> {
    constructor(private readonly departmentHistoryRepository: DomainDepartmentHistoryRepository) {
        super(departmentHistoryRepository);
    }

    /**
     * 부서 이력을 생성한다 (Setter 함수 활용)
     */
    async 부서이력을생성한다(
        params: {
            departmentId: string;
            departmentName: string;
            departmentCode: string;
            type: DepartmentType;
            parentDepartmentId?: string;
            order: number;
            isActive: boolean;
            isException: boolean;
            effectiveStartDate: string;
            changeReason?: string;
            changedBy?: string;
        },
        queryRunner?: QueryRunner,
    ): Promise<DepartmentHistory> {
        const newHistory = new DepartmentHistory();

        // 기본 정보
        newHistory.departmentId = params.departmentId;
        newHistory.부서명을설정한다(params.departmentName);
        newHistory.부서코드를설정한다(params.departmentCode);
        newHistory.유형을설정한다(params.type);

        if (params.parentDepartmentId !== undefined) {
            newHistory.상위부서를설정한다(params.parentDepartmentId);
        }

        newHistory.정렬순서를설정한다(params.order);
        newHistory.활성상태를설정한다(params.isActive);
        newHistory.예외처리를설정한다(params.isException);

        // 유효 기간
        newHistory.effectiveStartDate = params.effectiveStartDate;
        newHistory.현재유효상태로설정한다();

        // 변경 추적
        if (params.changeReason) {
            newHistory.변경사유를설정한다(params.changeReason);
        }
        newHistory.changedBy = params.changedBy;

        return await this.save(newHistory, { queryRunner });
    }

    /**
     * 부서 이력의 종료일을 설정한다 (Setter 함수 활용)
     */
    async 이력을종료한다(
        history: DepartmentHistory,
        effectiveEndDate: string,
        queryRunner?: QueryRunner,
    ): Promise<DepartmentHistory> {
        // Setter 함수로 종료일 설정 (isCurrent도 함께 false로 변경)
        history.유효종료일을설정한다(effectiveEndDate);

        // 저장
        return await this.save(history, { queryRunner });
    }

    /**
     * 특정 시점에 유효한 부서 이력을 조회한다
     */
    async findByDateRange(departmentId: string, targetDate: string): Promise<DepartmentHistory | null> {
        return this.departmentHistoryRepository
            .createQueryBuilder('dh')
            .where('dh.departmentId = :departmentId', { departmentId })
            .andWhere('dh.effectiveStartDate <= :targetDate', { targetDate })
            .andWhere('(dh.effectiveEndDate IS NULL OR dh.effectiveEndDate > :targetDate)', { targetDate })
            .getOne();
    }

    /**
     * 현재 유효한 부서 이력을 조회한다
     */
    async findCurrentByDepartmentId(departmentId: string): Promise<DepartmentHistory | null> {
        return this.departmentHistoryRepository.findOne({
            where: { departmentId, isCurrent: true },
        });
    }

    /**
     * 부서의 모든 이력을 조회한다
     */
    async findHistoryByDepartmentId(departmentId: string): Promise<DepartmentHistory[]> {
        return this.departmentHistoryRepository.findAll({
            where: { departmentId },
            order: { effectiveStartDate: 'DESC' },
        });
    }

    /**
     * 현재 유효한 모든 부서 이력을 조회한다
     */
    async findAllCurrent(): Promise<DepartmentHistory[]> {
        return this.departmentHistoryRepository.findAll({
            where: { isCurrent: true },
            order: { order: 'ASC' },
        });
    }
}
