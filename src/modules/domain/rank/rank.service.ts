import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainRankRepository } from './rank.repository';
import { BaseService } from '../../../../libs/common/services/base.service';
import { Rank } from '../../../../libs/database/entities';
import { In } from 'typeorm';

@Injectable()
export class DomainRankService extends BaseService<Rank> {
    constructor(private readonly rankRepository: DomainRankRepository) {
        super(rankRepository);
    }

    // 직급 찾기
    async findById(rankId: string): Promise<Rank> {
        const rank = await this.rankRepository.findOne({
            where: { id: rankId },
        });
        return rank;
    }

    // 여러 직급 ID로 찾기
    async findByIds(rankIds: string[]): Promise<Rank[]> {
        if (rankIds.length === 0) return [];
        return this.rankRepository.findAll({
            where: { id: In(rankIds) },
        });
    }

    // 직급명으로 찾기
    async findByName(rankName: string): Promise<Rank> {
        const rank = await this.rankRepository.findOne({
            where: { rankName },
        });

        return rank;
    }

    // 직급 코드로 찾기
    async findByCode(rankCode: string): Promise<Rank> {
        const rank = await this.rankRepository.findOne({
            where: { rankCode },
        });

        return rank;
    }

    // 직급 코드로 찾기 (컨텍스트용 별칭)
    async findByRankCode(rankCode: string): Promise<Rank> {
        return this.findByCode(rankCode);
    }

    // 전체 직급 목록 조회 (레벨 순)
    async findAllRanks(): Promise<Rank[]> {
        return this.rankRepository.findAll({
            order: { level: 'DESC' },
        });
    }

    // 레벨별 직급 조회
    async findByLevel(level: number): Promise<Rank[]> {
        return this.rankRepository.findAll({
            where: { level },
            order: { rankName: 'ASC' },
        });
    }

    // 특정 레벨 이상의 직급 조회
    async findByMinLevel(minLevel: number): Promise<Rank[]> {
        return this.rankRepository.findAll({
            order: { level: 'DESC' },
        });
    }

    // 직급 생성
    async createRank(data: { rankName: string; rankCode: string; level: number }): Promise<Rank> {
        return this.save(data);
    }

    // 직급 수정
    async updateRank(rankId: string, data: Partial<Rank>): Promise<Rank> {
        return this.update(rankId, data);
    }

    // 직급 삭제
    async deleteRank(rankId: string): Promise<void> {
        return this.delete(rankId);
    }

    // ==================== 단순한 도메인 함수들 (기존 컨텍스트에서 이동) ====================

    /**
     * 직급 존재여부 확인
     */
    async exists(rankId: string): Promise<boolean> {
        const rank = await this.findById(rankId);
        console.log('rank', rank);
        if (rank) {
            return true;
        }
        return false;
    }

    /**
     * 직급 코드 중복 확인
     */
    async isCodeDuplicate(rankCode: string, excludeId?: string): Promise<boolean> {
        const rank = await this.findByCode(rankCode);
        console.log('rank', rank);
        if (rank) {
            return true;
        }
        return false;
    }

    // ==================== 아키텍처 규칙 적용 메서드 (Setter 활용) ====================

    /**
     * 직급을생성한다
     */
    async 직급을생성한다(
        params: {
            rankName: string;
            rankCode: string;
            level: number;
        },
        queryRunner?: QueryRunner,
    ): Promise<Rank> {
        const rank = new Rank();

        rank.직급명을설정한다(params.rankName);
        rank.직급코드를설정한다(params.rankCode);
        rank.레벨을설정한다(params.level);

        return await this.save(rank, { queryRunner });
    }

    /**
     * 직급을수정한다
     */
    async 직급을수정한다(
        rank: Rank,
        params: {
            rankName?: string;
            rankCode?: string;
            level?: number;
        },
        queryRunner?: QueryRunner,
    ): Promise<Rank> {
        if (params.rankName !== undefined) {
            rank.직급명을설정한다(params.rankName);
        }

        if (params.rankCode !== undefined) {
            rank.직급코드를설정한다(params.rankCode);
        }

        if (params.level !== undefined) {
            rank.레벨을설정한다(params.level);
        }

        return await this.save(rank, { queryRunner });
    }
}
