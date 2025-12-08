import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Department, DepartmentType } from '../department/department.entity';

@Entity('department_history')
@Index(['departmentId', 'effectiveStartDate'])
@Index(['effectiveStartDate', 'effectiveEndDate'])
@Index(['isCurrent'], { where: '"isCurrent" = true' })
export class DepartmentHistory {
    @PrimaryGeneratedColumn('uuid')
    historyId: string;

    // 부서 ID (변경되지 않는 비즈니스 키)
    @Column({ type: 'uuid', comment: '부서 ID' })
    departmentId: string;

    @Column({ comment: '부서명' })
    departmentName: string;

    @Column({ comment: '부서 코드' })
    departmentCode: string;

    @Column({
        comment: '유형',
        type: 'enum',
        enum: DepartmentType,
        default: DepartmentType.DEPARTMENT,
    })
    type: DepartmentType;

    @Column({ comment: '상위 부서 ID', type: 'uuid', nullable: true })
    parentDepartmentId?: string;

    @Column({ comment: '정렬 순서', default: 0 })
    order: number;

    @Column({ comment: '활성화 상태', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ comment: '예외처리 여부', type: 'boolean', default: false })
    isException: boolean;

    // ✨ SCD Type 2: 유효 기간
    @Column({
        type: 'date',
        comment: '유효 시작일 (이 정보가 유효해진 날짜)',
    })
    effectiveStartDate: string;

    @Column({
        type: 'date',
        nullable: true,
        comment: '유효 종료일 (NULL = 현재 유효)',
    })
    effectiveEndDate: string | null;

    @Column({
        type: 'boolean',
        default: true,
        comment: '현재 유효 여부',
    })
    isCurrent: boolean;

    // 변경 추적
    @Column({
        type: 'text',
        nullable: true,
        comment: '변경 사유',
    })
    changeReason?: string;

    @Column({
        type: 'uuid',
        nullable: true,
        comment: '변경자 ID',
    })
    changedBy?: string;

    @Column({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
        comment: '이력 생성 시각',
    })
    createdAt: Date;

    // 원본 Department와의 관계
    @ManyToOne(() => Department)
    @JoinColumn({ name: 'departmentId' })
    department: Department;

    // ==================== Setter 메서드 ====================

    /**
     * 부서명을설정한다
     */
    부서명을설정한다(departmentName: string): void {
        this.departmentName = departmentName;
    }

    /**
     * 부서코드를설정한다
     */
    부서코드를설정한다(departmentCode: string): void {
        this.departmentCode = departmentCode;
    }

    /**
     * 유형을설정한다
     */
    유형을설정한다(type: DepartmentType): void {
        this.type = type;
    }

    /**
     * 상위부서를설정한다
     */
    상위부서를설정한다(parentDepartmentId?: string): void {
        this.parentDepartmentId = parentDepartmentId;
    }

    /**
     * 정렬순서를설정한다
     */
    정렬순서를설정한다(order: number): void {
        this.order = order;
    }

    /**
     * 활성상태를설정한다
     */
    활성상태를설정한다(isActive: boolean): void {
        this.isActive = isActive;
    }

    /**
     * 예외처리를설정한다
     */
    예외처리를설정한다(isException: boolean): void {
        this.isException = isException;
    }

    /**
     * 유효종료일을설정한다
     */
    유효종료일을설정한다(effectiveEndDate: string): void {
        this.effectiveEndDate = effectiveEndDate;
        this.isCurrent = false;
    }

    /**
     * 현재유효상태로설정한다
     */
    현재유효상태로설정한다(): void {
        this.isCurrent = true;
        this.effectiveEndDate = null;
    }

    /**
     * 변경사유를설정한다
     */
    변경사유를설정한다(changeReason: string): void {
        this.changeReason = changeReason;
    }
}
