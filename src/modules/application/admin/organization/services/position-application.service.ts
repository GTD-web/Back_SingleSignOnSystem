import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withTransaction } from '../../../../../../libs/common/utils/transaction.util';
import { CreatePositionRequestDto, UpdatePositionRequestDto, PositionResponseDto } from '../dto';
import { OrganizationManagementContextService } from '../../../../context/organization-management/organization-management-context.service';

/**
 * 직책 관리 Business Service
 * - 트랜잭션 관리
 * - DTO 변환
 * - Context 조율
 */
@Injectable()
export class PositionApplicationService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly organizationContext: OrganizationManagementContextService,
    ) {}

    // ==================== 조회 (트랜잭션 불필요) ====================

    async 직책목록조회(): Promise<PositionResponseDto[]> {
        const positions = await this.organizationContext.모든_직책을_조회한다();
        return positions.map(this.직책을_응답DTO로_변환한다);
    }

    // ==================== 명령 (트랜잭션 필요) ====================

    async 직책생성(createPositionDto: CreatePositionRequestDto): Promise<PositionResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const newPosition = await this.organizationContext.직책을_생성한다(createPositionDto, queryRunner);
            return this.직책을_응답DTO로_변환한다(newPosition);
        });
    }

    async 직책수정(id: string, updatePositionDto: UpdatePositionRequestDto): Promise<PositionResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const updatedPosition = await this.organizationContext.직책을_수정한다(id, updatePositionDto, queryRunner);
            return this.직책을_응답DTO로_변환한다(updatedPosition);
        });
    }

    async 직책삭제(id: string): Promise<void> {
        await withTransaction(this.dataSource, async (queryRunner) => {
            await this.organizationContext.직책을_삭제한다(id, queryRunner);
        });
    }

    // ==================== DTO 변환 ====================

    private 직책을_응답DTO로_변환한다 = (position: any): PositionResponseDto => ({
        id: position.id,
        positionTitle: position.positionTitle,
        positionCode: position.positionCode,
        level: position.level,
        hasManagementAuthority: position.hasManagementAuthority,
    });
}
