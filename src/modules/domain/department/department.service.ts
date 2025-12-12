import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainDepartmentRepository } from './department.repository';
import { BaseService } from '../../../../libs/common/services/base.service';
import { Department, DepartmentType } from '../../../../libs/database/entities';
import { In } from 'typeorm';

@Injectable()
export class DomainDepartmentService extends BaseService<Department> {
    constructor(private readonly departmentRepository: DomainDepartmentRepository) {
        super(departmentRepository);
    }

    // 부서 찾기
    async findById(departmentId: string): Promise<Department> {
        const department = await this.departmentRepository.findOne({
            where: { id: departmentId },
        });
        return department;
    }

    // 부서 찾기 (상위 부서 정보 포함)
    async findByIdWithParent(departmentId: string): Promise<Department> {
        const department = await this.departmentRepository.findOne({
            where: { id: departmentId },
            relations: ['parentDepartment'],
        });
        return department;
    }

    // 여러 부서 ID로 찾기
    async findByIds(departmentIds: string[]): Promise<Department[]> {
        if (departmentIds.length === 0) return [];
        return this.departmentRepository.findAll({
            where: { id: In(departmentIds) },
        });
    }

    // 여러 부서 ID로 찾기 (상위 부서 정보 포함)
    async findByIdsWithParent(departmentIds: string[]): Promise<Department[]> {
        if (departmentIds.length === 0) return [];
        return this.departmentRepository.findAll({
            where: { id: In(departmentIds) },
            relations: ['parentDepartment'],
        });
    }

    // 부서 이름으로 찾기
    async findByName(departmentName: string): Promise<Department> {
        const department = await this.departmentRepository.findOne({
            where: { departmentName },
        });
        if (!department) {
            throw new NotFoundException('부서를 찾을 수 없습니다.');
        }
        return department;
    }

    // 부서 코드로 찾기
    async findByCode(departmentCode: string): Promise<Department> {
        const department = await this.departmentRepository.findOne({
            where: { departmentCode },
        });
        return department;
    }

    // 부서 코드로 찾기 (컨텍스트용 별칭)
    async findByDepartmentCode(departmentCode: string): Promise<Department> {
        return this.findByCode(departmentCode);
    }

    // 전체 부서 목록 조회
    async findAllDepartments(): Promise<Department[]> {
        return this.departmentRepository.findAll({
            order: { departmentName: 'ASC' },
        });
    }

    // 최상위 부서 목록 조회
    async findRootDepartments(): Promise<Department[]> {
        return this.departmentRepository.findAll({
            where: { parentDepartmentId: null },
            order: { order: 'ASC' },
        });
    }

    // 전체 부서 목록 조회 (relations 제거 - 수동으로 계층구조 구축)
    async findAllDepartmentsWithChildren(): Promise<Department[]> {
        return this.departmentRepository.findAll({
            order: { order: 'ASC' },
        });
    }

    // 하위 부서 조회
    async findChildDepartments(departmentId: string): Promise<Department[]> {
        return this.departmentRepository.findAll({
            where: { parentDepartmentId: departmentId },
            order: { order: 'ASC' },
        });
    }

    // 부서 생성
    async createDepartment(data: {
        departmentName: string;
        departmentCode: string;
        type: any;
        parentDepartmentId?: string;
        order?: number;
    }): Promise<Department> {
        return this.save(data);
    }

    // 부서 수정
    async updateDepartment(departmentId: string, data: Partial<Department>): Promise<Department> {
        return this.update(departmentId, data);
    }

    // 부서 삭제
    async deleteDepartment(departmentId: string): Promise<void> {
        return this.delete(departmentId);
    }

    // ==================== 단순한 도메인 함수들 (기존 컨텍스트에서 이동) ====================

    /**
     * 부서 존재여부 확인
     */
    async exists(departmentId: string): Promise<boolean> {
        const department = await this.findById(departmentId);
        console.log('department', department);
        if (department) {
            return true;
        }
        return false;
    }

    /**
     * 부서 코드 중복 확인
     */
    async isCodeDuplicate(departmentCode: string, excludeId?: string): Promise<boolean> {
        const department = await this.findByCode(departmentCode);
        if (department) {
            return true;
        }
        return false;
    }

    /**
     * 같은 부모를 가진 부서들의 순서 범위 내 부서들 조회
     */
    async findDepartmentsInOrderRange(
        parentDepartmentId: string | null,
        minOrder: number,
        maxOrder: number,
    ): Promise<Department[]> {
        const queryBuilder = this.departmentRepository.createQueryBuilder('department');

        if (parentDepartmentId === null) {
            queryBuilder.where('department.parentDepartmentId IS NULL');
        } else {
            queryBuilder.where('department.parentDepartmentId = :parentDepartmentId', { parentDepartmentId });
        }

        return queryBuilder
            .andWhere('department.order >= :minOrder', { minOrder })
            .andWhere('department.order <= :maxOrder', { maxOrder })
            .orderBy('department.order', 'ASC')
            .getMany();
    }

    /**
     * 여러 부서의 순서를 일괄 업데이트 (unique constraint 충돌 방지)
     */
    async bulkUpdateOrders(updates: { id: string; order: number }[]): Promise<void> {
        await this.departmentRepository.manager.transaction(async (transactionalEntityManager) => {
            // Step 1: 모든 부서를 임시 음수 값으로 변경 (unique constraint 충돌 회피)
            const tempOffset = -1000000;
            for (let i = 0; i < updates.length; i++) {
                await transactionalEntityManager.update(Department, { id: updates[i].id }, { order: tempOffset - i });
            }

            // Step 2: 최종 순서로 업데이트
            for (const update of updates) {
                await transactionalEntityManager.update(Department, { id: update.id }, { order: update.order });
            }
        });
    }

    /**
     * 여러 부서의 필드를 일괄 업데이트
     */
    async bulkUpdate(departmentIds: string[], updateData: Partial<Department>): Promise<void> {
        if (departmentIds.length === 0) return;

        await this.departmentRepository.manager.transaction(async (transactionalEntityManager) => {
            for (const id of departmentIds) {
                await transactionalEntityManager.update(Department, { id }, updateData);
            }
        });
    }

    /**
     * 같은 부모를 가진 부서들의 개수 조회
     */
    async countByParentDepartmentId(parentDepartmentId: string | null): Promise<number> {
        const queryBuilder = this.departmentRepository.createQueryBuilder('department');

        if (parentDepartmentId === null) {
            queryBuilder.where('department.parentDepartmentId IS NULL');
        } else {
            queryBuilder.where('department.parentDepartmentId = :parentDepartmentId', { parentDepartmentId });
        }

        return queryBuilder.getCount();
    }

    /**
     * 같은 부모를 가진 부서들의 다음 순서 번호를 조회
     */
    async getNextOrderForParent(parentDepartmentId: string | null): Promise<number> {
        const queryBuilder = this.departmentRepository.createQueryBuilder('department');

        if (parentDepartmentId === null) {
            queryBuilder.where('department.parentDepartmentId IS NULL');
        } else {
            queryBuilder.where('department.parentDepartmentId = :parentDepartmentId', { parentDepartmentId });
        }

        // 최대 order 조회 후 +1 (없으면 0부터 시작)
        const result = await queryBuilder.select('MAX(department.order)', 'maxOrder').getRawOne();
        const maxOrder = result?.maxOrder ?? -1;
        return maxOrder + 1;
    }

    // ==================== 아키텍처 규칙 적용 메서드 (Setter 활용) ====================

    /**
     * 부서를생성한다
     */
    async 부서를생성한다(
        params: {
            departmentName: string;
            departmentCode: string;
            type: DepartmentType;
            parentDepartmentId?: string;
            order?: number;
            isActive?: boolean;
            isException?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Department> {
        const department = new Department();

        department.부서명을설정한다(params.departmentName);
        department.부서코드를설정한다(params.departmentCode);
        department.유형을설정한다(params.type);

        if (params.parentDepartmentId !== undefined) {
            department.상위부서를설정한다(params.parentDepartmentId);
        }

        if (params.order !== undefined) {
            department.정렬순서를설정한다(params.order);
        }

        if (params.isActive !== undefined) {
            if (params.isActive) {
                department.활성화한다();
            } else {
                department.비활성화한다();
            }
        }

        if (params.isException !== undefined) {
            department.예외처리를설정한다(params.isException);
        }

        return await this.save(department, { queryRunner });
    }

    /**
     * 부서를수정한다
     */
    async 부서를수정한다(
        department: Department,
        params: {
            departmentName?: string;
            departmentCode?: string;
            type?: DepartmentType;
            parentDepartmentId?: string;
            order?: number;
            isActive?: boolean;
            isException?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Department> {
        if (params.departmentName !== undefined) {
            department.부서명을설정한다(params.departmentName);
        }

        if (params.departmentCode !== undefined) {
            department.부서코드를설정한다(params.departmentCode);
        }

        if (params.type !== undefined) {
            department.유형을설정한다(params.type);
        }

        if (params.parentDepartmentId !== undefined) {
            department.상위부서를설정한다(params.parentDepartmentId);
        }

        if (params.order !== undefined) {
            department.정렬순서를설정한다(params.order);
        }

        if (params.isActive !== undefined) {
            if (params.isActive) {
                department.활성화한다();
            } else {
                department.비활성화한다();
            }
        }

        if (params.isException !== undefined) {
            department.예외처리를설정한다(params.isException);
        }

        return await this.save(department, { queryRunner });
    }

    /**
     * 부서를삭제한다
     */
    async 부서를삭제한다(department: Department, queryRunner?: QueryRunner): Promise<Department> {
        department.소프트삭제한다();
        return await this.save(department, { queryRunner });
    }

    /**
     * 부서삭제를복구한다
     */
    async 부서삭제를복구한다(department: Department, queryRunner?: QueryRunner): Promise<Department> {
        department.삭제를복구한다();
        return await this.save(department, { queryRunner });
    }

    /**
     * 부서순서를재배치한다
     * 단일 부서의 순서를 변경하고 영향받는 다른 부서들의 순서도 함께 조정한다
     */
    async 부서순서를재배치한다(
        params: {
            departmentId: string;
            currentOrder: number;
            newOrder: number;
            affectedDepartments: Department[];
        },
        queryRunner?: QueryRunner,
    ): Promise<void> {
        const { departmentId, currentOrder, newOrder, affectedDepartments } = params;

        const executeLogic = async (manager: any) => {
            // Step 1: 이동할 부서를 임시 음수 값으로 변경
            await manager.update(Department, { id: departmentId }, { order: -999 });

            // Step 2: 나머지 부서들의 순서 업데이트
            const updates: { id: string; order: number }[] = [];
            if (currentOrder < newOrder) {
                // 아래로 이동: 현재 순서보다 크고 새로운 순서 이하인 부서들을 -1
                for (const dept of affectedDepartments) {
                    if (dept.id !== departmentId && dept.order > currentOrder && dept.order <= newOrder) {
                        updates.push({ id: dept.id, order: dept.order - 1 });
                    }
                }
            } else {
                // 위로 이동: 새로운 순서 이상이고 현재 순서보다 작은 부서들을 +1
                for (const dept of affectedDepartments) {
                    if (dept.id !== departmentId && dept.order >= newOrder && dept.order < currentOrder) {
                        updates.push({ id: dept.id, order: dept.order + 1 });
                    }
                }
            }

            // Step 3: 나머지 부서들 일괄 업데이트
            if (updates.length > 0) {
                const tempOffset = -1000000;
                for (let i = 0; i < updates.length; i++) {
                    await manager.update(Department, { id: updates[i].id }, { order: tempOffset - i });
                }
                for (const update of updates) {
                    await manager.update(Department, { id: update.id }, { order: update.order });
                }
            }

            // Step 4: 이동할 부서를 최종 순서로 변경
            await manager.update(Department, { id: departmentId }, { order: newOrder });
        };

        if (queryRunner) {
            await executeLogic(queryRunner.manager);
        } else {
            await this.departmentRepository.manager.transaction(executeLogic);
        }
    }
}
