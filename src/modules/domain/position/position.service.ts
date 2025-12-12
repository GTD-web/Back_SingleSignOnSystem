import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainPositionRepository } from './position.repository';
import { BaseService } from '../../../../libs/common/services/base.service';
import { Position } from '../../../../libs/database/entities';
import { In } from 'typeorm';

@Injectable()
export class DomainPositionService extends BaseService<Position> {
    constructor(private readonly positionRepository: DomainPositionRepository) {
        super(positionRepository);
    }

    // 직책 찾기
    async findById(positionId: string): Promise<Position> {
        const position = await this.positionRepository.findOne({
            where: { id: positionId },
        });
        return position;
    }

    // 여러 직책 ID로 찾기
    async findByIds(positionIds: string[]): Promise<Position[]> {
        if (positionIds.length === 0) return [];
        return this.positionRepository.findAll({
            where: { id: In(positionIds) },
        });
    }

    // 직책명으로 찾기
    async findByTitle(positionTitle: string): Promise<Position> {
        const position = await this.positionRepository.findOne({
            where: { positionTitle },
        });
        return position;
    }

    // 직책 코드로 찾기
    async findByCode(positionCode: string): Promise<Position> {
        const position = await this.positionRepository.findOne({
            where: { positionCode },
        });
        return position;
    }

    // 직책 코드로 찾기 (컨텍스트용 별칭)
    async findByPositionCode(positionCode: string): Promise<Position> {
        return this.findByCode(positionCode);
    }

    // 레벨별 직책 조회
    async findByLevel(level: number): Promise<Position[]> {
        return this.positionRepository.findAll({
            where: { level },
            order: { level: 'ASC' },
        });
    }

    // 관리 권한이 있는 직책 조회
    async findManagementPositions(): Promise<Position[]> {
        return this.positionRepository.findAll({
            where: { hasManagementAuthority: true },
            order: { level: 'DESC' },
        });
    }

    // 🚀 성능 최적화: 전체 직책 목록 조회 (레벨 순)
    async findAllPositions(): Promise<Position[]> {
        return this.positionRepository.findAll({
            order: { level: 'ASC', positionTitle: 'ASC' },
        });
    }

    // 직책 생성
    async createPosition(data: {
        positionTitle: string;
        positionCode: string;
        level: number;
        hasManagementAuthority: boolean;
    }): Promise<Position> {
        return this.save(data);
    }

    // 직책 수정
    async updatePosition(positionId: string, data: Partial<Position>): Promise<Position> {
        return this.update(positionId, data);
    }

    // level로 직책 조회 (단일)
    async findOneByLevel(level: number): Promise<Position | null> {
        return this.positionRepository.findOne({
            where: { level },
        });
    }

    // level 범위의 직책들 조회
    async findByLevelRange(minLevel: number, maxLevel: number): Promise<Position[]> {
        const queryBuilder = this.positionRepository.createQueryBuilder('position');
        return queryBuilder
            .where('position.level >= :minLevel', { minLevel })
            .andWhere('position.level <= :maxLevel', { maxLevel })
            .orderBy('position.level', 'ASC')
            .getMany();
    }

    // 가장 낮은 직책 조회 (level이 가장 높은 직책)
    async findLowestPosition(): Promise<Position | null> {
        const queryBuilder = this.positionRepository.createQueryBuilder('position');
        const result = await queryBuilder.orderBy('position.level', 'DESC').limit(1).getOne();
        return result;
    }

    // level 변경 (순서 재조정 포함)
    async changeLevel(positionId: string, newLevel: number): Promise<Position> {
        const currentPosition = await this.findById(positionId);
        const currentLevel = currentPosition.level;

        // level이 변경되지 않으면 그대로 반환
        if (currentLevel === newLevel) {
            return currentPosition;
        }

        // level은 1 이상이어야 함
        if (newLevel < 1) {
            newLevel = 1;
            // 조정된 level이 현재 level과 같으면 그대로 반환
            if (currentLevel === newLevel) {
                return currentPosition;
            }
        }

        // 최대 level 조회
        const queryBuilder = this.positionRepository.createQueryBuilder('position');
        const maxLevelResult = await queryBuilder.select('MAX(position.level)', 'maxLevel').getRawOne();
        const maxLevel = maxLevelResult?.maxLevel ?? 0;

        // 목표 level이 최대 level을 넘어가면 최대 level로 조정
        if (newLevel > maxLevel) {
            newLevel = maxLevel;
            // 조정된 level이 현재 level과 같으면 그대로 반환
            if (currentLevel === newLevel) {
                return currentPosition;
            }
        }

        // 새로운 level이 이미 존재하는지 확인
        const existingPosition = await this.findOneByLevel(newLevel);

        if (existingPosition) {
            // 임시값으로 사용할 level (기존 최대값보다 큰 값)
            const tempLevel = maxLevel + 1000;

            // 1. 현재 직책을 임시 level로 변경
            await this.update(positionId, { level: tempLevel });

            // 2. 기존 level과 목표 level 사이의 직책들을 이동
            if (currentLevel < newLevel) {
                // 아래로 이동: currentLevel + 1 ~ newLevel 범위의 직책들을 -1씩 이동
                const positionsToShift = await this.findByLevelRange(currentLevel + 1, newLevel);
                for (const position of positionsToShift) {
                    await this.update(position.id, { level: position.level - 1 });
                }
            } else {
                // 위로 이동: newLevel ~ currentLevel - 1 범위의 직책들을 +1씩 이동
                const positionsToShift = await this.findByLevelRange(newLevel, currentLevel - 1);
                // 역순으로 처리하여 충돌 방지
                for (let i = positionsToShift.length - 1; i >= 0; i--) {
                    await this.update(positionsToShift[i].id, { level: positionsToShift[i].level + 1 });
                }
            }

            // 3. 현재 직책을 목표 level로 변경
            return await this.update(positionId, { level: newLevel });
        } else {
            // 새로운 level이 비어있으면 그냥 변경
            return await this.update(positionId, { level: newLevel });
        }
    }

    // 직책 삭제
    async deletePosition(positionId: string): Promise<void> {
        return this.delete(positionId);
    }

    // ==================== 단순한 도메인 함수들 (기존 컨텍스트에서 이동) ====================

    /**
     * 직책 존재여부 확인
     */
    async exists(positionId: string): Promise<boolean> {
        const position = await this.findById(positionId);
        console.log('position', position);
        if (position) {
            await this.findById(positionId);
            return true;
        }
        return false;
    }

    /**
     * 직책 코드 중복 확인
     */
    async isCodeDuplicate(positionCode: string, excludeId?: string): Promise<boolean> {
        const position = await this.findByCode(positionCode);
        console.log('position', position);
        if (position) {
            return true;
        }
        return false;
    }

    // ==================== 아키텍처 규칙 적용 메서드 (Setter 활용) ====================

    /**
     * 직책을생성한다
     */
    async 직책을생성한다(
        params: {
            positionTitle: string;
            positionCode: string;
            level: number;
            hasManagementAuthority: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Position> {
        const position = new Position();

        position.직책명을설정한다(params.positionTitle);
        position.직책코드를설정한다(params.positionCode);
        position.레벨을설정한다(params.level);
        position.관리권한을설정한다(params.hasManagementAuthority);

        return await this.save(position, { queryRunner });
    }

    /**
     * 직책을수정한다
     */
    async 직책을수정한다(
        position: Position,
        params: {
            positionTitle?: string;
            positionCode?: string;
            level?: number;
            hasManagementAuthority?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Position> {
        if (params.positionTitle !== undefined) {
            position.직책명을설정한다(params.positionTitle);
        }

        if (params.positionCode !== undefined) {
            position.직책코드를설정한다(params.positionCode);
        }

        if (params.level !== undefined) {
            position.레벨을설정한다(params.level);
        }

        if (params.hasManagementAuthority !== undefined) {
            position.관리권한을설정한다(params.hasManagementAuthority);
        }

        return await this.save(position, { queryRunner });
    }
}
