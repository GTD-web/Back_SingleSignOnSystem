import { Injectable, BadRequestException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainRankService } from '../../domain/rank/rank.service';
import { DomainEmployeeService } from '../../domain/employee/employee.service';
import { DomainEmployeeRankHistoryService } from '../../domain/employee-rank-history/employee-rank-history.service';
import { Rank } from '../../../../libs/database/entities';

/**
 * 직급 관리 컨텍스트 서비스 (Command)
 * 직급 생성/수정/삭제 및 관리
 */
@Injectable()
export class RankManagementContextService {
    constructor(
        private readonly 직급서비스: DomainRankService,
        private readonly 직원서비스: DomainEmployeeService,
        private readonly 직원직급이력서비스: DomainEmployeeRankHistoryService,
    ) {}

    // ==================== 직급 조회 ====================

    /**
     * 모든 직급을 조회한다
     */
    async 모든_직급을_조회한다(): Promise<Rank[]> {
        return this.직급서비스.findAllRanks();
    }

    /**
     * 직급 ID로 직급을 조회한다
     */
    async 직급_ID로_직급을_조회한다(rankId: string): Promise<Rank> {
        return this.직급서비스.findById(rankId);
    }

    // ==================== 직급 CRUD ====================

    /**
     * 직급을 생성한다
     */
    async 직급을_생성한다(
        직급정보: { rankName: string; rankCode: string; level: number },
        queryRunner?: QueryRunner,
    ): Promise<Rank> {
        // 1. 직급 코드 중복 확인
        const isDuplicate = await this.직급서비스.isCodeDuplicate(직급정보.rankCode);
        if (isDuplicate) {
            throw new Error('이미 존재하는 직급 코드입니다.');
        }

        // 2. Domain Service를 통해 직급 생성
        return await this.직급서비스.직급을생성한다(
            {
                rankName: 직급정보.rankName,
                rankCode: 직급정보.rankCode,
                level: 직급정보.level,
            },
            queryRunner,
        );
    }

    /**
     * 직급을 수정한다
     */
    async 직급을_수정한다(
        rankId: string,
        수정정보: {
            rankName?: string;
            rankCode?: string;
            level?: number;
        },
        queryRunner?: QueryRunner,
    ): Promise<Rank> {
        // 1. 직급 존재 확인
        const rank = await this.직급서비스.findById(rankId);

        // 2. 직급 코드 중복 확인 (자신 제외)
        if (수정정보.rankCode) {
            const isDuplicate = await this.직급서비스.isCodeDuplicate(수정정보.rankCode, rankId);
            if (isDuplicate) {
                throw new Error('이미 존재하는 직급 코드입니다.');
            }
        }

        // 3. Domain Service를 통해 직급 수정
        return await this.직급서비스.직급을수정한다(rank, 수정정보, queryRunner);
    }

    /**
     * 직급을 삭제한다
     */
    async 직급을_삭제한다(rankId: string, queryRunner?: QueryRunner): Promise<void> {
        // 1. 직급 존재 확인
        await this.직급서비스.findById(rankId);

        // 2. 해당 직급을 가진 직원이 있는지 확인
        const employeesWithRank = await this.직원서비스.findByRankId(rankId);
        if (employeesWithRank.length > 0) {
            throw new BadRequestException('해당 직급을 가진 직원이 있어 삭제할 수 없습니다.');
        }

        // 3. 해당 직급의 이력이 있는지 확인
        const rankHistories = await this.직원직급이력서비스.findByRankId(rankId);
        if (rankHistories.length > 0) {
            throw new BadRequestException('해당 직급의 이력이 있어 삭제할 수 없습니다.');
        }

        // 4. 직급 삭제
        await this.직급서비스.deleteRank(rankId);
    }
}

