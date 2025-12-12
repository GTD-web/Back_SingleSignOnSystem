import { Injectable, NotFoundException } from '@nestjs/common';
import { DomainEmployeeRankHistoryRepository } from './employee-rank-history.repository';
import { BaseService } from '../../../../libs/common/services/base.service';
import { EmployeeRankHistory } from '../../../../libs/database/entities';
import { QueryRunner } from 'typeorm';

@Injectable()
export class DomainEmployeeRankHistoryService extends BaseService<EmployeeRankHistory> {
    constructor(private readonly employeeRankHistoryRepository: DomainEmployeeRankHistoryRepository) {
        super(employeeRankHistoryRepository);
    }

    // 직원의 직급 이력 조회 (최신순)
    async findByEmployeeId(employeeId: string): Promise<EmployeeRankHistory[]> {
        return this.employeeRankHistoryRepository.findAll({
            where: { employeeId },
            order: { createdAt: 'DESC' },
        });
    }

    // 특정 직급의 이력 조회
    async findByRankId(rankId: string): Promise<EmployeeRankHistory[]> {
        return this.employeeRankHistoryRepository.findAll({
            where: { rankId },
            order: { createdAt: 'DESC' },
        });
    }

    // 직원의 현재(최신) 직급 이력 조회
    async findCurrentRankByEmployeeId(employeeId: string): Promise<EmployeeRankHistory> {
        const histories = await this.employeeRankHistoryRepository.findAll({
            where: { employeeId },
            order: { createdAt: 'DESC' },
            take: 1,
        });

        if (!histories.length) {
            throw new NotFoundException('직원의 직급 이력을 찾을 수 없습니다.');
        }

        return histories[0];
    }

    // 특정 직원-직급 이력 찾기
    async findByEmployeeAndRank(employeeId: string, rankId: string): Promise<EmployeeRankHistory[]> {
        return this.employeeRankHistoryRepository.findAll({
            where: { employeeId, rankId },
            order: { createdAt: 'DESC' },
        });
    }

    // 직급 변경 이력 생성
    async createRankHistory(employeeId: string, rankId: string): Promise<EmployeeRankHistory> {
        return this.employeeRankHistoryRepository.save({
            employeeId,
            rankId,
        });
    }

    // 특정 기간 동안의 직급 변경 이력 조회
    async findByDateRange(startDate: Date, endDate: Date): Promise<EmployeeRankHistory[]> {
        return this.employeeRankHistoryRepository.findAll({
            order: { createdAt: 'DESC' },
        });
    }

    // 직원의 직급 변경 횟수 조회
    async getRankChangeCountByEmployeeId(employeeId: string): Promise<number> {
        const histories = await this.findByEmployeeId(employeeId);
        return histories.length;
    }

    // 가장 최근에 변경된 직급 이력들 조회
    async findRecentRankChanges(limit: number = 20): Promise<EmployeeRankHistory[]> {
        return this.employeeRankHistoryRepository.findAll({
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    // ID로 직급 이력 조회
    async findById(historyId: string): Promise<EmployeeRankHistory> {
        return this.employeeRankHistoryRepository.findOne({
            where: { id: historyId },
        });
    }

    // 직급 이력 생성
    async createHistory(
        data: { employeeId: string; rankId: string },
        queryRunner?: QueryRunner,
    ): Promise<EmployeeRankHistory> {
        return this.save(data, { queryRunner });
    }

    // 직급 이력 삭제
    async deleteHistory(historyId: string, queryRunner?: QueryRunner): Promise<void> {
        return this.delete(historyId, { queryRunner });
    }
}
