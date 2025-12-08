import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withTransaction } from '../../../../../../libs/common/utils/transaction.util';
import { CreateRankRequestDto, UpdateRankRequestDto, RankResponseDto } from '../dto';
import { OrganizationManagementContextService } from '../../../../context/organization-management/organization-management-context.service';

/**
 * 직급 관리 Business Service
 * - 트랜잭션 관리
 * - DTO 변환
 * - Context 조율
 */
@Injectable()
export class RankApplicationService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly organizationContext: OrganizationManagementContextService,
    ) {}

    // ==================== 조회 (트랜잭션 불필요) ====================

    async 직급목록조회(): Promise<RankResponseDto[]> {
        const ranks = await this.organizationContext.모든_직급을_조회한다();
        return ranks.map(this.직급을_응답DTO로_변환한다);
    }

    // ==================== 명령 (트랜잭션 필요) ====================

    async 직급생성(createRankDto: CreateRankRequestDto): Promise<RankResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const newRank = await this.organizationContext.직급을_생성한다(createRankDto, queryRunner);
            return this.직급을_응답DTO로_변환한다(newRank);
        });
    }

    async 직급수정(id: string, updateRankDto: UpdateRankRequestDto): Promise<RankResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const updatedRank = await this.organizationContext.직급을_수정한다(id, updateRankDto, queryRunner);
            return this.직급을_응답DTO로_변환한다(updatedRank);
        });
    }

    async 직급삭제(id: string): Promise<void> {
        await withTransaction(this.dataSource, async (queryRunner) => {
            await this.organizationContext.직급을_삭제한다(id, queryRunner);
        });
    }

    // ==================== DTO 변환 ====================

    private 직급을_응답DTO로_변환한다 = (rank: any): RankResponseDto => ({
        id: rank.id,
        rankName: rank.rankName,
        rankCode: rank.rankCode,
        level: rank.level,
    });
}

