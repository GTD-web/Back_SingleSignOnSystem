import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainDepartmentService } from '../../domain/department/department.service';
import { DomainEmployeeDepartmentPositionService } from '../../domain/employee-department-position/employee-department-position.service';
import { Department } from '../../../../libs/database/entities';

/**
 * 부서 관리 컨텍스트 서비스 (Command)
 * 부서 생성/수정/삭제 및 계층구조 관리
 */
@Injectable()
export class DepartmentManagementContextService {
    constructor(
        private readonly 부서서비스: DomainDepartmentService,
        private readonly 직원부서직책서비스: DomainEmployeeDepartmentPositionService,
    ) {}

    // ==================== 부서 조회 ====================

    /**
     * 부서 ID로 부서를 조회한다
     */
    async 부서_ID로_부서를_조회한다(departmentId: string): Promise<Department> {
        return this.부서서비스.findById(departmentId);
    }

    /**
     * 부서 코드로 부서를 조회한다
     */
    async 부서_코드로_부서를_조회한다(departmentCode: string): Promise<Department> {
        return this.부서서비스.findByCode(departmentCode);
    }

    /**
     * 모든 부서를 조회한다
     */
    async 모든_부서를_조회한다(): Promise<Department[]> {
        const departments = await this.부서서비스.findAll();
        const terminatedDepartment = await this.부서서비스.findByCode('퇴사자');
        return [...departments, terminatedDepartment];
    }

    /**
     * 특정 부서의 모든 하위 부서를 재귀적으로 조회한다
     */
    async 부서의_모든_하위부서들을_재귀적으로_조회한다(departmentId: string): Promise<Department[]> {
        // 전체 부서 목록 조회
        const allDepartments = await this.부서서비스.findAllDepartmentsWithChildren();
        const departmentMap = new Map(allDepartments.map((dept) => [dept.id, dept]));

        // 재귀적으로 하위 부서 수집
        const childDepartments: Department[] = [];
        this.모든_하위부서를_재귀적으로_수집한다(departmentId, departmentMap, childDepartments);

        return childDepartments;
    }

    private 모든_하위부서를_재귀적으로_수집한다(
        parentDepartmentId: string,
        departmentMap: Map<string, Department>,
        result: Department[],
    ): void {
        // 현재 부서의 직접 하위 부서들 찾기
        const directChildren = Array.from(departmentMap.values()).filter(
            (dept) => dept.parentDepartmentId === parentDepartmentId,
        );

        for (const child of directChildren) {
            // 결과 배열에 추가
            result.push(child);
            // 재귀적으로 하위 부서의 하위 부서도 수집
            this.모든_하위부서를_재귀적으로_수집한다(child.id, departmentMap, result);
        }
    }

    /**
     * 여러 부서를 일괄 수정한다
     */
    async 여러_부서를_일괄_수정한다(departmentIds: string[], updateData: Partial<Department>): Promise<void> {
        await this.부서서비스.bulkUpdate(departmentIds, updateData);
    }

    // ==================== 부서 CRUD ====================

    /**
     * 부서를 생성한다
     */
    async 부서를_생성한다(
        부서정보: {
            departmentName: string;
            departmentCode: string;
            type: any;
            parentDepartmentId?: string;
            order?: number;
        },
        queryRunner?: QueryRunner,
    ): Promise<Department> {
        // 1. 부서 코드 중복 확인
        const isDuplicate = await this.부서서비스.isCodeDuplicate(부서정보.departmentCode);
        if (isDuplicate) {
            throw new Error('이미 존재하는 부서 코드입니다.');
        }

        // 2. 상위 부서 존재 확인 (선택사항)
        if (부서정보.parentDepartmentId) {
            const parentExists = await this.부서서비스.exists(부서정보.parentDepartmentId);
            if (!parentExists) {
                throw new Error('상위 부서를 찾을 수 없습니다.');
            }
        }

        // 3. 순서가 지정되지 않은 경우 자동으로 다음 순서 조회
        let order = 부서정보.order;
        if (order === undefined) {
            order = await this.부서서비스.getNextOrderForParent(부서정보.parentDepartmentId || null);
        }

        // 4. Domain Service를 통해 부서 생성
        return await this.부서서비스.부서를생성한다(
            {
                departmentName: 부서정보.departmentName,
                departmentCode: 부서정보.departmentCode,
                type: 부서정보.type,
                parentDepartmentId: 부서정보.parentDepartmentId,
                order,
            },
            queryRunner,
        );
    }

    /**
     * 부서를 수정한다
     */
    async 부서를_수정한다(
        departmentId: string,
        수정정보: {
            departmentName?: string;
            departmentCode?: string;
            type?: any;
            parentDepartmentId?: string;
            isActive?: boolean;
        },
        queryRunner?: QueryRunner,
    ): Promise<Department> {
        // 1. 부서 존재 확인
        const department = await this.부서서비스.findById(departmentId);
        if (!department) {
            throw new NotFoundException('부서를 찾을 수 없습니다.');
        }

        // 2. 부서 코드 중복 확인 (자신 제외)
        if (수정정보.departmentCode) {
            const isDuplicate = await this.부서서비스.isCodeDuplicate(수정정보.departmentCode, departmentId);
            if (isDuplicate) {
                throw new Error('이미 존재하는 부서 코드입니다.');
            }
        }

        // 3. 상위 부서 존재 확인 (선택사항)
        if (수정정보.parentDepartmentId) {
            const parentExists = await this.부서서비스.exists(수정정보.parentDepartmentId);
            if (!parentExists) {
                throw new Error('상위 부서를 찾을 수 없습니다.');
            }
        }

        // 4. 상위 부서가 변경되는 경우 순서 재배치 처리
        const oldParentDepartmentId = department.parentDepartmentId || null;
        const newParentDepartmentId =
            수정정보.parentDepartmentId !== undefined ? 수정정보.parentDepartmentId || null : oldParentDepartmentId;

        let newOrder: number | undefined = undefined;

        if (oldParentDepartmentId !== newParentDepartmentId) {
            const currentOrder = department.order;

            // 4-1. 먼저 이동하려는 부서를 새로운 상위 부서의 맨 뒤로 이동
            const nextOrder = await this.부서서비스.getNextOrderForParent(newParentDepartmentId);

            // 이동하려는 부서를 임시로 음수로 설정 (unique constraint 충돌 방지)
            await this.부서서비스.updateDepartment(departmentId, {
                parentDepartmentId: newParentDepartmentId,
                order: -999,
            });

            // 4-2. 원래 상위 부서의 하위 부서들 순서 재배치 (빈 자리 메꾸기)
            const oldSiblingDepartments =
                oldParentDepartmentId === null
                    ? await this.부서서비스.findRootDepartments()
                    : await this.부서서비스.findChildDepartments(oldParentDepartmentId);

            // 이동된 부서의 다음 순번부터 순서를 1씩 감소
            const orderUpdates: { id: string; order: number }[] = [];
            for (const sibling of oldSiblingDepartments) {
                if (sibling.id !== departmentId && sibling.order > currentOrder) {
                    orderUpdates.push({ id: sibling.id, order: sibling.order - 1 });
                }
            }

            if (orderUpdates.length > 0) {
                await this.부서서비스.bulkUpdateOrders(orderUpdates);
            }

            // 4-3. 이동한 부서를 최종 순번으로 설정
            newOrder = nextOrder;
        }

        // 5. Domain Service를 통해 부서 수정
        const updateData = {
            ...수정정보,
            ...(newOrder !== undefined && { order: newOrder }),
        };
        return await this.부서서비스.부서를수정한다(department, updateData, queryRunner);
    }

    /**
     * 부서를 삭제한다
     */
    async 부서를_삭제한다(departmentId: string, queryRunner?: QueryRunner): Promise<void> {
        // 1. 부서 존재 확인 및 정보 조회
        const department = await this.부서서비스.findById(departmentId);
        if (!department) {
            throw new NotFoundException('부서를 찾을 수 없습니다.');
        }

        // 2. 하위 부서가 있는지 확인
        const childDepartments = await this.부서서비스.findChildDepartments(departmentId);
        if (childDepartments.length > 0) {
            throw new Error('하위 부서가 존재하여 삭제할 수 없습니다.');
        }

        // 3. 해당 부서에 배치된 직원이 있는지 확인
        const assignedEmployees = await this.직원부서직책서비스.findByDepartmentId(departmentId);
        if (assignedEmployees.length > 0) {
            throw new Error('해당 부서에 배치된 직원이 있어 삭제할 수 없습니다.');
        }

        // 4. Domain Service를 통해 부서 삭제
        await this.부서서비스.부서를삭제한다(department, queryRunner);
    }

    /**
     * 부서 순서를 변경한다
     */
    async 부서순서를_변경한다(departmentId: string, newOrder: number, queryRunner?: QueryRunner): Promise<Department> {
        // 1. 부서 존재 확인 및 현재 순서 조회
        const department = await this.부서서비스.findById(departmentId);
        if (!department) {
            throw new Error('부서를 찾을 수 없습니다.');
        }

        const currentOrder = department.order;

        // 2. 같은 부모를 가진 부서들의 개수 확인 및 순서 범위 검증
        const parentDepartmentId = department.parentDepartmentId || null;
        const departmentCount = await this.부서서비스.countByParentDepartmentId(parentDepartmentId);

        // 순서 범위 검증: 최소값은 0, 최대값은 개수
        const minOrderValue = 0;
        const maxOrderValue = departmentCount - 1 > 0 ? departmentCount - 1 : 0;

        // 순서 범위 조정
        if (newOrder < minOrderValue) {
            newOrder = minOrderValue;
        } else if (newOrder > maxOrderValue) {
            newOrder = maxOrderValue;
        }

        // 3. 순서가 같으면 변경할 필요 없음
        if (currentOrder === newOrder) {
            return department;
        }

        // 4. 같은 부모를 가진 부서들의 순서 재배치
        const minOrderRange = Math.min(currentOrder, newOrder);
        const maxOrderRange = Math.max(currentOrder, newOrder);

        const affectedDepartments = await this.부서서비스.findDepartmentsInOrderRange(
            parentDepartmentId,
            minOrderRange,
            maxOrderRange,
        );

        // 5. 도메인 서비스를 통해 순서 재배치 실행
        await this.부서서비스.부서순서를재배치한다(
            {
                departmentId,
                currentOrder,
                newOrder,
                affectedDepartments,
            },
            queryRunner,
        );

        // 6. 업데이트된 부서 반환
        return await this.부서서비스.findById(departmentId);
    }
}
