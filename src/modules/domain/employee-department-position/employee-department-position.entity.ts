import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { Department } from '../department/department.entity';
import { Position } from '../position/position.entity';

export enum ManagerType {
    DIRECT = 'direct', // 직접 상사
    FUNCTIONAL = 'functional', // 기능적 상사
    PROJECT = 'project', // 프로젝트 리더
    TEMPORARY = 'temporary', // 임시 상사
    DEPUTY = 'deputy', // 대리 권한
}

@Entity('employee_department_positions')
@Unique(['employeeId', 'departmentId']) // 한 직원이 같은 부서에서는 하나의 직책만 가능
@Index(['employeeId'])
@Index(['departmentId'])
@Index(['positionId'])
export class EmployeeDepartmentPosition {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ comment: '직원 ID', type: 'uuid' })
    employeeId: string;

    @Column({ comment: '부서 ID', type: 'uuid' })
    departmentId: string;

    @Column({ comment: '직책 ID', type: 'uuid' })
    positionId: string;

    @Column({ comment: '관리자 권한 여부', type: 'boolean', default: false })
    isManager: boolean;

    @CreateDateColumn({ comment: '생성일' })
    createdAt: Date;

    @UpdateDateColumn({ comment: '수정일' })
    updatedAt: Date;

    // 관계 설정
    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'employeeId' })
    employee: Employee;

    @ManyToOne(() => Department)
    @JoinColumn({ name: 'departmentId' })
    department: Department;

    @ManyToOne(() => Position)
    @JoinColumn({ name: 'positionId' })
    position: Position;

    // ==================== Setter 메서드 ====================

    /**
     * 부서를설정한다
     */
    부서를설정한다(departmentId: string): void {
        this.departmentId = departmentId;
    }

    /**
     * 직책을설정한다
     */
    직책을설정한다(positionId: string): void {
        this.positionId = positionId;
    }

    /**
     * 관리자권한을설정한다
     */
    관리자권한을설정한다(isManager: boolean): void {
        this.isManager = isManager;
    }
}
