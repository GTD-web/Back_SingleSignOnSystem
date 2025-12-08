import { Injectable, BadRequestException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainPositionService } from '../../domain/position/position.service';
import { DomainEmployeeDepartmentPositionService } from '../../domain/employee-department-position/employee-department-position.service';
import { Position } from '../../../../libs/database/entities';

/**
 * 직책 관리 컨텍스트 서비스 (Command)
 * 직책 생성/수정/삭제 및 관리
 */
@Injectable()
export class PositionManagementContextService {
    constructor(
        private readonly 직책서비스: DomainPositionService,
        private readonly 직원부서직책서비스: DomainEmployeeDepartmentPositionService,
    ) {}

    // ==================== 직책 조회 ====================

    /**
     * 모든 직책을 조회한다
     */
    async 모든_직책을_조회한다(): Promise<Position[]> {
        return this.직책서비스.findAllPositions();
    }

    /**
     * 직책 ID로 직책을 조회한다
     */
    async 직책_ID로_직책을_조회한다(positionId: string): Promise<Position> {
        return this.직책서비스.findById(positionId);
    }

    /**
     * 가장 낮은 직책을 조회한다
     */
    async 가장_낮은_직책을_조회한다(): Promise<Position> {
        const position = await this.직책서비스.findLowestPosition();
        if (!position) {
            throw new BadRequestException('직책을 찾을 수 없습니다.');
        }
        return position;
    }

    // ==================== 직책 CRUD ====================

    /**
     * 직책을 생성한다
     */
    async 직책을_생성한다(
        직책정보: {
            positionTitle: string;
            positionCode: string;
            level: number;
            hasManagementAuthority?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Position> {
        // 1. 직책 코드 중복 확인
        const isDuplicate = await this.직책서비스.isCodeDuplicate(직책정보.positionCode);
        if (isDuplicate) {
            throw new Error('이미 존재하는 직책 코드입니다.');
        }

        // 2. level 검증
        const existingPosition = await this.직책서비스.findOneByLevel(직책정보.level);
        if (existingPosition) {
            throw new BadRequestException(`이미 존재하는 level입니다: ${직책정보.level}`);
        }

        const allPositions = await this.직책서비스.findAllPositions();
        const maxLevel = allPositions.length > 0 ? Math.max(...allPositions.map((p) => p.level)) : 0;

        const expectedLevel = maxLevel + 1;
        if (직책정보.level !== expectedLevel) {
            throw new BadRequestException(`level은 ${expectedLevel}이어야 합니다. (현재 최대 level: ${maxLevel})`);
        }

        // 3. Domain Service를 통해 직책 생성
        return await this.직책서비스.직책을생성한다(
            {
                positionTitle: 직책정보.positionTitle,
                positionCode: 직책정보.positionCode,
                level: 직책정보.level,
                hasManagementAuthority: 직책정보.hasManagementAuthority || false,
            },
            queryRunner,
        );
    }

    /**
     * 직책을 수정한다
     */
    async 직책을_수정한다(
        positionId: string,
        수정정보: {
            positionTitle?: string;
            positionCode?: string;
            level?: number;
            hasManagementAuthority?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Position> {
        // 1. 직책 존재 확인
        const position = await this.직책서비스.findById(positionId);

        // 2. 직책 코드 중복 확인 (자신 제외)
        if (수정정보.positionCode) {
            const isDuplicate = await this.직책서비스.isCodeDuplicate(수정정보.positionCode, positionId);
            if (isDuplicate) {
                throw new Error('이미 존재하는 직책 코드입니다.');
            }
        }

        // 3. level 변경이 있는 경우 순서 재조정 로직 실행
        if (수정정보.level !== undefined) {
            await this.직책서비스.changeLevel(positionId, 수정정보.level);
            // level은 이미 변경되었으므로 제외
            const { level, ...restData } = 수정정보;
            if (Object.keys(restData).length > 0) {
                return await this.직책서비스.직책을수정한다(position, restData, queryRunner);
            } else {
                return await this.직책서비스.findById(positionId);
            }
        }

        // 4. level 변경이 없는 경우 Domain Service를 통해 수정
        return await this.직책서비스.직책을수정한다(position, 수정정보, queryRunner);
    }

    /**
     * 직책을 삭제한다
     */
    async 직책을_삭제한다(positionId: string, queryRunner?: QueryRunner): Promise<void> {
        // 1. 직책 존재 확인
        const position = await this.직책서비스.findById(positionId);

        // 2. 해당 직책에 배치된 직원이 있는지 확인
        const assignedEmployees = await this.직원부서직책서비스.findByPositionId(positionId);
        if (assignedEmployees.length > 0) {
            throw new BadRequestException('해당 직책에 배치된 직원이 있어 삭제할 수 없습니다.');
        }

        // 3. Domain Service를 통해 직책 삭제
        await this.직책서비스.deletePosition(positionId);
    }
}

