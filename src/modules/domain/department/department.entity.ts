import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Unique,
    Index,
} from 'typeorm';

export enum DepartmentType {
    COMPANY = 'COMPANY',
    DIVISION = 'DIVISION',
    DEPARTMENT = 'DEPARTMENT',
    TEAM = 'TEAM',
}

@Entity('departments')
@Unique('UQ_departments_parent_order', ['parentDepartmentId', 'order'])
@Index('IDX_departments_parent_order', ['parentDepartmentId', 'order'])
@Index('UQ_departments_root_order', ['order'], {
    unique: true,
    where: '"parentDepartmentId" IS NULL',
})
export class Department {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ comment: '부서명' })
    departmentName: string;

    @Column({ unique: true, comment: '부서 코드' })
    departmentCode: string;

    @Column({ comment: '유형', type: 'enum', enum: DepartmentType, default: DepartmentType.DEPARTMENT })
    type: DepartmentType;

    @Column({ comment: '상위 부서 ID', type: 'uuid', nullable: true })
    parentDepartmentId?: string;

    @Column({ comment: '정렬 순서', default: 0 })
    order: number;

    @Column({ comment: '활성화 상태', type: 'boolean', default: true })
    isActive: boolean;

    @Column({ comment: '예외처리 여부', type: 'boolean', default: false })
    isException: boolean;

    // Soft Delete 필드
    @DeleteDateColumn({ comment: '삭제일' })
    deletedAt?: Date;

    // 부서장 관계는 별도 이력 테이블로 관리
    // 부서 계층 구조는 유지 (조직도 표현을 위해)
    @ManyToOne(() => Department, (department) => department.childDepartments, { nullable: true })
    @JoinColumn({ name: 'parentDepartmentId' })
    parentDepartment?: Department;

    @OneToMany(() => Department, (department) => department.parentDepartment)
    childDepartments: Department[];

    @CreateDateColumn({ comment: '생성일' })
    createdAt: Date;

    @UpdateDateColumn({ comment: '수정일' })
    updatedAt: Date;

    // ==================== Setter 메서드 ====================

    /**
     * 부서명을 설정한다
     */
    부서명을설정한다(departmentName: string): void {
        this.departmentName = departmentName;
    }

    /**
     * 부서코드를 설정한다
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
     * 활성화한다
     */
    활성화한다(): void {
        this.isActive = true;
    }

    /**
     * 비활성화한다
     */
    비활성화한다(): void {
        this.isActive = false;
    }

    /**
     * 예외처리를설정한다
     */
    예외처리를설정한다(isException: boolean): void {
        this.isException = isException;
    }

    /**
     * 소프트삭제한다
     */
    소프트삭제한다(): void {
        this.deletedAt = new Date();
        this.isActive = false;
    }

    /**
     * 삭제를복구한다
     */
    삭제를복구한다(): void {
        this.deletedAt = null;
    }
}
