import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { DomainDepartmentHistoryService } from '../../domain/department-history/department-history.service';
import { DomainEmployeeDepartmentPositionHistoryService } from '../../domain/employee-department-position-history/employee-department-position-history.service';
import { DepartmentHistory } from '../../domain/department-history/department-history.entity';
import { EmployeeDepartmentPositionHistory } from '../../domain/employee-department-position-history/employee-department-position-history.entity';

@Injectable()
export class OrganizationHistoryContextService {
    private readonly logger = new Logger(OrganizationHistoryContextService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly departmentHistoryService: DomainDepartmentHistoryService,
        private readonly empDeptPosHistoryService: DomainEmployeeDepartmentPositionHistoryService,
    ) {}

    /**
     * Date를 YYYY-MM-DD 형식으로 변환한다
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 날짜에서 하루를 뺀다
     */
    private subtractDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result;
    }

    /**
     * 부서를 생성하고 이력을 생성한다
     * ⚠️ queryRunner는 Business Layer에서 전달받아야 함
     */
    async 부서를_생성하고_이력을_생성한다(
        dto: {
            departmentId: string;
            departmentName: string;
            departmentCode: string;
            type: any;
            parentDepartmentId?: string;
            order?: number;
            isActive?: boolean;
            isException?: boolean;
            effectiveDate: Date;
            changeReason?: string;
            changedBy?: string;
        },
        queryRunner: QueryRunner,
    ): Promise<DepartmentHistory> {
        // Domain Service를 통해 새 이력 레코드 생성
        const savedHistory = await this.departmentHistoryService.부서이력을생성한다(
            {
                departmentId: dto.departmentId,
                departmentName: dto.departmentName,
                departmentCode: dto.departmentCode,
                type: dto.type,
                parentDepartmentId: dto.parentDepartmentId,
                order: dto.order ?? 0,
                isActive: dto.isActive ?? true,
                isException: dto.isException ?? false,
                effectiveStartDate: this.formatDate(dto.effectiveDate),
                changeReason: dto.changeReason || '부서 생성',
                changedBy: dto.changedBy,
            },
            queryRunner,
        );

        this.logger.log(`부서 생성 이력 완료: ${dto.departmentId}`);
        return savedHistory;
    }

    /**
     * 부서 정보를 변경하고 이력을 생성한다
     * ⚠️ 날짜 범위 중복 방지: effectiveEndDate는 새로운 effectiveStartDate의 하루 전
     * ⚠️ queryRunner는 Business Layer에서 전달받아야 함
     */
    async 부서정보를_변경하고_이력을_생성한다(
        dto: {
            departmentId: string;
            departmentName?: string;
            departmentCode?: string;
            type?: any;
            parentDepartmentId?: string;
            order?: number;
            isActive?: boolean;
            isException?: boolean;
            effectiveDate: Date;
            changeReason?: string;
            changedBy?: string;
        },
        queryRunner: QueryRunner,
    ): Promise<DepartmentHistory> {
        const newStartDate = dto.effectiveDate;
        const previousEndDate = this.formatDate(this.subtractDays(newStartDate, 1));

        // 1. 현재 부서 정보 조회 (한 번만 조회)
        const currentDept = await this.departmentHistoryService.findCurrentByDepartmentId(dto.departmentId);

        // 2. 기존 이력이 있으면 종료 처리 (조회한 Entity 재사용)
        if (currentDept) {
            await this.departmentHistoryService.이력을종료한다(currentDept, previousEndDate, queryRunner);
        }

        // 3. Domain Service를 통해 새 이력 레코드 생성
        const savedHistory = await this.departmentHistoryService.부서이력을생성한다(
            {
                departmentId: dto.departmentId,
                departmentName: dto.departmentName || currentDept?.departmentName || '',
                departmentCode: dto.departmentCode || currentDept?.departmentCode || '',
                type: dto.type ?? currentDept?.type,
                parentDepartmentId: dto.parentDepartmentId ?? currentDept?.parentDepartmentId,
                order: dto.order ?? currentDept?.order ?? 0,
                isActive: dto.isActive ?? currentDept?.isActive ?? true,
                isException: dto.isException ?? currentDept?.isException ?? false,
                effectiveStartDate: this.formatDate(newStartDate),
                changeReason: dto.changeReason,
                changedBy: dto.changedBy,
            },
            queryRunner,
        );

        this.logger.log(`부서 이력 생성 완료: ${dto.departmentId}`);
        return savedHistory;
    }

    /**
     * 부서 이력을 종료한다 (삭제 시 사용)
     * ⚠️ queryRunner는 Business Layer에서 전달받아야 함
     */
    async 부서이력을_종료한다(
        dto: {
            departmentId: string;
            effectiveDate: Date;
            changeReason?: string;
            changedBy?: string;
        },
        queryRunner: QueryRunner,
    ): Promise<void> {
        const endDate = this.formatDate(dto.effectiveDate);

        // 현재 부서 이력 조회
        const currentDept = await this.departmentHistoryService.findCurrentByDepartmentId(dto.departmentId);

        if (currentDept) {
            // 이력 종료 처리
            await this.departmentHistoryService.이력을종료한다(currentDept, endDate, queryRunner);
            this.logger.log(`부서 이력 종료 완료: ${dto.departmentId}`);
        } else {
            this.logger.warn(`종료할 부서 이력이 없습니다: ${dto.departmentId}`);
        }
    }

    /**
     * 직원을 발령하고 이력을 생성한다
     * ⚠️ 날짜 범위 중복 방지: effectiveEndDate는 새로운 effectiveStartDate의 하루 전
     * ⚠️ queryRunner는 Business Layer에서 전달받아야 함
     */
    async 직원을_발령하고_이력을_생성한다(
        dto: {
            employeeId: string;
            departmentId: string;
            positionId: string;
            rankId?: string;
            isManager: boolean;
            effectiveDate: Date;
            assignmentReason?: string;
            assignedBy?: string;
        },
        queryRunner: QueryRunner,
    ): Promise<EmployeeDepartmentPositionHistory> {
        const newStartDate = dto.effectiveDate;
        const previousEndDate = this.formatDate(this.subtractDays(newStartDate, 1));

        // 1. 현재 발령 정보 조회 (한 번만 조회)
        const currentAssignment = await this.empDeptPosHistoryService.findCurrentByEmployeeId(dto.employeeId);

        // 2. 기존 이력이 있으면 종료 처리 (조회한 Entity 재사용)
        if (currentAssignment) {
            await this.empDeptPosHistoryService.이력을종료한다(currentAssignment, previousEndDate, queryRunner);
        }

        // 3. Domain Service를 통해 새 배치 이력 생성
        const savedAssignment = await this.empDeptPosHistoryService.직원발령이력을생성한다(
            {
                employeeId: dto.employeeId,
                departmentId: dto.departmentId,
                positionId: dto.positionId,
                rankId: dto.rankId,
                isManager: dto.isManager,
                effectiveStartDate: this.formatDate(newStartDate),
                assignmentReason: dto.assignmentReason,
                assignedBy: dto.assignedBy,
            },
            queryRunner,
        );

        this.logger.log(`직원 발령 이력 생성 완료: ${dto.employeeId}`);
        return savedAssignment;
    }

    /**
     * 직원 배치 이력을 종료한다 (배치 해제 시 사용)
     * ⚠️ queryRunner는 Business Layer에서 전달받아야 함
     */
    async 직원배치이력을_종료한다(
        dto: {
            employeeId: string;
            effectiveDate: Date;
            assignmentReason?: string;
            assignedBy?: string;
        },
        queryRunner: QueryRunner,
    ): Promise<void> {
        const endDate = this.formatDate(dto.effectiveDate);

        // 현재 배치 이력 조회
        const currentAssignment = await this.empDeptPosHistoryService.findCurrentByEmployeeId(dto.employeeId);

        if (currentAssignment) {
            // 이력 종료 처리
            await this.empDeptPosHistoryService.이력을종료한다(currentAssignment, endDate, queryRunner);
            this.logger.log(`직원 배치 이력 종료 완료: ${dto.employeeId}`);
        } else {
            this.logger.warn(`종료할 직원 배치 이력이 없습니다: ${dto.employeeId}`);
        }
    }

    /**
     * 특정 시점의 조직도를 조회한다 (Self-Join으로 계층 구조 재현)
     */
    async 특정시점의_조직도를_조회한다(targetDate: string) {
        // Self-Join으로 부서 계층 구조 재현
        const departments = await this.dataSource
            .createQueryBuilder()
            .select('dh_child')
            .from(DepartmentHistory, 'dh_child')
            .leftJoinAndMapOne(
                'dh_child.parentDepartmentHistory',
                DepartmentHistory,
                'dh_parent',
                `dh_child.parentDepartmentId = dh_parent.departmentId 
                AND dh_parent.effectiveStartDate <= :targetDate 
                AND (dh_parent.effectiveEndDate IS NULL OR dh_parent.effectiveEndDate > :targetDate)`,
            )
            .where('dh_child.effectiveStartDate <= :targetDate', { targetDate })
            .andWhere('(dh_child.effectiveEndDate IS NULL OR dh_child.effectiveEndDate > :targetDate)', { targetDate })
            .setParameter('targetDate', targetDate)
            .getMany();

        const assignments = await this.empDeptPosHistoryService
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.employee', 'emp')
            .leftJoinAndSelect('eh.department', 'dept')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.effectiveStartDate <= :targetDate', { targetDate })
            .andWhere('(eh.effectiveEndDate IS NULL OR eh.effectiveEndDate > :targetDate)', { targetDate })
            .getMany();

        return {
            asOfDate: targetDate,
            departments,
            assignments,
        };
    }

    /**
     * 현재 유효한 조직도를 조회한다 (성능 최적화)
     */
    async 현재_조직도를_조회한다() {
        const departments = await this.departmentHistoryService.findAllCurrent();
        const assignments = await this.empDeptPosHistoryService.findAllCurrent();

        return {
            departments,
            assignments,
        };
    }

    /**
     * 직원의 조직 이동 이력을 조회한다
     */
    async 직원의_조직이동이력을_조회한다(employeeId: string) {
        return this.empDeptPosHistoryService.findHistoryByEmployeeId(employeeId);
    }

    /**
     * 부서의 변경 이력을 조회한다
     */
    async 부서의_변경이력을_조회한다(departmentId: string) {
        return this.departmentHistoryService.findHistoryByDepartmentId(departmentId);
    }

    /**
     * 특정 직원의 특정 시점 조직 정보를 조회한다
     */
    async 직원의_특정시점_조직정보를_조회한다(employeeId: string, targetDate: string) {
        return this.empDeptPosHistoryService.findByEmployeeAtDate(employeeId, targetDate);
    }

    /**
     * 특정 부서의 특정 시점 인원을 조회한다
     */
    async 부서의_특정시점_인원을_조회한다(departmentId: string, targetDate: string) {
        return this.empDeptPosHistoryService.findByDepartmentAtDate(departmentId, targetDate);
    }
}
