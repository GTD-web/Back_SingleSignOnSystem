import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withTransaction } from '../../../../../../libs/common/utils/transaction.util';
import {
    CreateDepartmentRequestDto,
    UpdateDepartmentRequestDto,
    DepartmentResponseDto,
    DepartmentListResponseDto,
    UpdateDepartmentOrderRequestDto,
    UpdateDepartmentParentRequestDto,
    UpdateDepartmentActiveStatusRequestDto,
    DepartmentHierarchyResponseDto,
    DepartmentWithEmployeesDto,
    DepartmentEmployeeInfoDto,
} from '../dto';
import { OrganizationManagementContextService } from '../../../../context/organization-management/organization-management-context.service';
import { OrganizationHistoryContextService } from '../../../../context/organization-history/organization-history-context.service';
import { DepartmentType } from '../../../../domain/department/department.entity';
import { Department } from '../../../../domain/department/department.entity';
import { Employee } from '../../../../domain/employee/employee.entity';
import { Position } from '../../../../domain/position/position.entity';
import { Rank } from '../../../../domain/rank/rank.entity';

/**
 * 부서 관리 Business Service
 * - 트랜잭션 관리
 * - DTO 변환
 * - Context 조율
 */
@Injectable()
export class DepartmentApplicationService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly organizationContext: OrganizationManagementContextService,
        private readonly historyContext: OrganizationHistoryContextService,
    ) {}

    // ==================== 조회 (트랜잭션 불필요) ====================

    async 부서_계층구조별_직원정보를_조회한다(): Promise<DepartmentHierarchyResponseDto> {
        const result = await this.organizationContext.부서_계층구조별_직원정보를_조회한다(
            undefined, // rootDepartmentId
            undefined, // maxDepth
            true, // withEmployeeDetail
            true, // includeTerminated
            true, // includeEmptyDepartments
            true, // includeInactiveDepartments (admin은 비활성화된 부서도 포함)
        );

        const departments = this.부서_계층구조를_직원정보와_함께_변환한다(
            result.departments,
            result.employeesByDepartment,
            result.departmentDetails,
        );

        return { departments: departments.filter((department) => department.parentDepartmentId === null) };
    }

    async 퇴사자부서_직원목록을_조회한다(): Promise<DepartmentHierarchyResponseDto> {
        // 퇴사자 부서 찾기
        const terminatedDepartment = await this.organizationContext.부서_코드로_부서를_조회한다('퇴사자');
        if (!terminatedDepartment) {
            return { departments: [] };
        }

        // 퇴사자 부서를 기준으로 계층구조 조회
        const result = await this.organizationContext.부서_계층구조별_직원정보를_조회한다(
            terminatedDepartment.id,
            undefined,
            true,
            true,
            true,
            true,
        );

        const departments = this.부서_계층구조를_직원정보와_함께_변환한다(
            result.departments,
            result.employeesByDepartment,
            result.departmentDetails,
        );

        return { departments };
    }

    async 부서목록조회(): Promise<DepartmentListResponseDto> {
        const departments = await this.organizationContext.부서_계층구조를_조회한다(undefined, undefined, true, true);

        return {
            departments: departments.map(this.부서를_응답DTO로_변환한다),
        };
    }

    async 부서상세조회(id: string): Promise<DepartmentResponseDto> {
        const department = await this.organizationContext.부서_ID로_부서를_조회한다(id);
        return this.부서를_응답DTO로_변환한다(department);
    }

    // ==================== 명령 (트랜잭션 필요) ====================

    async 부서생성(
        createDepartmentDto: CreateDepartmentRequestDto,
        executedBy?: string,
    ): Promise<DepartmentResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const newDepartment = await this.organizationContext.부서를_생성한다(
                {
                    departmentName: createDepartmentDto.departmentName,
                    departmentCode: createDepartmentDto.departmentCode,
                    type: createDepartmentDto.type,
                    parentDepartmentId: createDepartmentDto.parentDepartmentId,
                    order: createDepartmentDto.order,
                },
                queryRunner,
            );

            // 부서 생성 이력 기록
            await this.historyContext.부서를_생성하고_이력을_생성한다(
                {
                    departmentId: newDepartment.id,
                    departmentName: newDepartment.departmentName,
                    departmentCode: newDepartment.departmentCode,
                    type: newDepartment.type,
                    parentDepartmentId: newDepartment.parentDepartmentId,
                    order: newDepartment.order,
                    isActive: newDepartment.isActive,
                    isException: newDepartment.isException,
                    effectiveDate: new Date(),
                    changeReason: '부서 생성',
                    changedBy: executedBy,
                },
                queryRunner,
            );

            return this.부서를_응답DTO로_변환한다(newDepartment);
        });
    }

    async 부서수정(
        id: string,
        updateDepartmentDto: UpdateDepartmentRequestDto,
        executedBy?: string,
    ): Promise<DepartmentResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const updatedDepartment = await this.organizationContext.부서를_수정한다(
                id,
                updateDepartmentDto,
                queryRunner,
            );

            // 부서 수정 이력 기록
            await this.historyContext.부서정보를_변경하고_이력을_생성한다(
                {
                    departmentId: updatedDepartment.id,
                    departmentName: updatedDepartment.departmentName,
                    departmentCode: updatedDepartment.departmentCode,
                    type: updatedDepartment.type,
                    parentDepartmentId: updatedDepartment.parentDepartmentId,
                    order: updatedDepartment.order,
                    isActive: updatedDepartment.isActive,
                    isException: updatedDepartment.isException,
                    effectiveDate: new Date(),
                    changeReason: '부서 정보 수정',
                    changedBy: executedBy,
                },
                queryRunner,
            );

            return this.부서를_응답DTO로_변환한다(updatedDepartment);
        });
    }

    async 부서삭제(id: string, executedBy?: string): Promise<void> {
        await withTransaction(this.dataSource, async (queryRunner) => {
            // 부서 삭제 이력 기록 (삭제 전에 이력 종료)
            await this.historyContext.부서이력을_종료한다(
                {
                    departmentId: id,
                    effectiveDate: new Date(),
                    changeReason: '부서 삭제',
                    changedBy: executedBy,
                },
                queryRunner,
            );

            await this.organizationContext.부서를_삭제한다(id, queryRunner);
        });
    }

    async 부서순서변경(
        id: string,
        updateOrderDto: UpdateDepartmentOrderRequestDto,
        executedBy?: string,
    ): Promise<DepartmentResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const updatedDepartment = await this.organizationContext.부서순서를_변경한다(
                id,
                updateOrderDto.newOrder,
                queryRunner,
            );

            // 부서 순서 변경 이력 기록
            await this.historyContext.부서정보를_변경하고_이력을_생성한다(
                {
                    departmentId: updatedDepartment.id,
                    departmentName: updatedDepartment.departmentName,
                    departmentCode: updatedDepartment.departmentCode,
                    type: updatedDepartment.type,
                    parentDepartmentId: updatedDepartment.parentDepartmentId,
                    order: updatedDepartment.order,
                    isActive: updatedDepartment.isActive,
                    isException: updatedDepartment.isException,
                    effectiveDate: new Date(),
                    changeReason: '부서 순서 변경',
                    changedBy: executedBy,
                },
                queryRunner,
            );

            return this.부서를_응답DTO로_변환한다(updatedDepartment);
        });
    }

    async 부서상위부서변경(
        id: string,
        updateParentDto: UpdateDepartmentParentRequestDto,
        executedBy?: string,
    ): Promise<DepartmentResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const updatedDepartment = await this.organizationContext.부서를_수정한다(
                id,
                {
                    parentDepartmentId: updateParentDto.newParentDepartmentId,
                },
                queryRunner,
            );

            // 부서 상위부서 변경 이력 기록
            await this.historyContext.부서정보를_변경하고_이력을_생성한다(
                {
                    departmentId: updatedDepartment.id,
                    departmentName: updatedDepartment.departmentName,
                    departmentCode: updatedDepartment.departmentCode,
                    type: updatedDepartment.type,
                    parentDepartmentId: updatedDepartment.parentDepartmentId,
                    order: updatedDepartment.order,
                    isActive: updatedDepartment.isActive,
                    isException: updatedDepartment.isException,
                    effectiveDate: new Date(),
                    changeReason: '상위 부서 변경',
                    changedBy: executedBy,
                },
                queryRunner,
            );

            return this.부서를_응답DTO로_변환한다(updatedDepartment);
        });
    }

    async 부서활성화상태변경(
        id: string,
        updateActiveStatusDto: UpdateDepartmentActiveStatusRequestDto,
        executedBy?: string,
    ): Promise<DepartmentResponseDto> {
        return await withTransaction(this.dataSource, async (queryRunner) => {
            const updatedDepartment = await this.organizationContext.부서를_수정한다(
                id,
                {
                    isActive: updateActiveStatusDto.isActive,
                },
                queryRunner,
            );

            // 부서 활성화 상태 변경 이력 기록
            const changeReason = updateActiveStatusDto.isActive ? '부서 활성화' : '부서 비활성화';
            await this.historyContext.부서정보를_변경하고_이력을_생성한다(
                {
                    departmentId: updatedDepartment.id,
                    departmentName: updatedDepartment.departmentName,
                    departmentCode: updatedDepartment.departmentCode,
                    type: updatedDepartment.type,
                    parentDepartmentId: updatedDepartment.parentDepartmentId,
                    order: updatedDepartment.order,
                    isActive: updatedDepartment.isActive,
                    isException: updatedDepartment.isException,
                    effectiveDate: new Date(),
                    changeReason,
                    changedBy: executedBy,
                },
                queryRunner,
            );

            // 모든 하위 부서들을 재귀적으로 조회
            const allChildDepartments = await this.organizationContext.부서의_모든_하위부서들을_재귀적으로_조회한다(id);

            // 모든 하위 부서들의 활성화 상태를 벌크로 일괄 변경
            if (updateActiveStatusDto.isActive === false && allChildDepartments.length > 0) {
                const childDepartmentIds = allChildDepartments.map((dept) => dept.id);
                // TODO: 여러_부서를_일괄_수정한다 메서드에 queryRunner 전달 필요
                await this.organizationContext.여러_부서를_일괄_수정한다(childDepartmentIds, {
                    isActive: updateActiveStatusDto.isActive,
                });

                // 하위 부서들의 이력도 기록
                for (const childDept of allChildDepartments) {
                    await this.historyContext.부서정보를_변경하고_이력을_생성한다(
                        {
                            departmentId: childDept.id,
                            departmentName: childDept.departmentName,
                            departmentCode: childDept.departmentCode,
                            type: childDept.type,
                            parentDepartmentId: childDept.parentDepartmentId,
                            order: childDept.order,
                            isActive: false,
                            isException: childDept.isException,
                            effectiveDate: new Date(),
                            changeReason: '상위 부서 비활성화로 인한 자동 비활성화',
                            changedBy: executedBy,
                        },
                        queryRunner,
                    );
                }
            }

            return this.부서를_응답DTO로_변환한다(updatedDepartment);
        });
    }

    // ==================== DTO 변환 ====================

    private 부서를_응답DTO로_변환한다 = (department: any): DepartmentResponseDto => ({
        id: department.id,
        departmentName: department.departmentName,
        departmentCode: department.departmentCode,
        type: department.type,
        parentDepartmentId: department.parentDepartmentId,
        order: department.order,
        isActive: department.isActive ?? true,
        isException: department.isException ?? false,
        childDepartments: department.childDepartments?.map(this.부서를_응답DTO로_변환한다),
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
    });

    private 부서_계층구조를_직원정보와_함께_변환한다(
        departments: Department[],
        employeesByDepartment: Map<string, { employees: Employee[]; departmentPositions: Map<string, any> }>,
        departmentDetails?: Map<string, { department: Department; position: Position; rank: Rank }[]>,
    ): DepartmentWithEmployeesDto[] {
        const result: DepartmentWithEmployeesDto[] = [];

        for (const department of departments) {
            const departmentEmployeeInfo = employeesByDepartment.get(department.id) || {
                employees: [],
                departmentPositions: new Map(),
            };

            const employees: DepartmentEmployeeInfoDto[] = [];
            for (const employee of departmentEmployeeInfo.employees) {
                const departmentPosition = departmentEmployeeInfo.departmentPositions.get(employee.id);
                const deptDetails = departmentDetails?.get(department.id);
                const employeeDetail = deptDetails?.find(
                    (d) =>
                        departmentEmployeeInfo.departmentPositions.has(employee.id) &&
                        d.department.id === department.id,
                );

                employees.push({
                    id: employee.id,
                    employeeNumber: employee.employeeNumber,
                    name: employee.name,
                    email: employee.email,
                    phoneNumber: employee.phoneNumber,
                    positionId: departmentPosition?.positionId,
                    positionTitle: employeeDetail?.position?.positionTitle,
                    rankId: employee.currentRankId,
                    rankName: employeeDetail?.rank?.rankName,
                    isManager: departmentPosition?.isManager || false,
                    metadata: employee.metadata,
                });
            }

            const childDepartments = this.부서_계층구조를_직원정보와_함께_변환한다(
                department.childDepartments || [],
                employeesByDepartment,
                departmentDetails,
            );

            const departmentDto: DepartmentWithEmployeesDto = {
                id: department.id,
                departmentName: department.departmentName,
                departmentCode: department.departmentCode,
                type: department.type,
                parentDepartmentId: department.parentDepartmentId,
                order: department.order,
                isActive: department.isActive ?? true,
                isException: department.isException ?? false,
                employees: employees.sort((a, b) => a.name.localeCompare(b.name)),
                childDepartments:
                    childDepartments.length > 0 ? childDepartments.sort((a, b) => a.order - b.order) : undefined,
            };

            result.push(departmentDto);
        }

        return result.sort((a, b) => a.order - b.order);
    }
}
