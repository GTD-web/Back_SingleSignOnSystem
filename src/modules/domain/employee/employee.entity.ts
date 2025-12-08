import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { Gender, EmployeeStatus } from '../../../../libs/common/enums';
import { Rank } from '../rank/rank.entity';
import { EmployeeDepartmentPosition } from '../employee-department-position/employee-department-position.entity';
import { EmployeeFcmToken } from '../employee-fcm-token/employee-fcm-token.entity';

@Entity('employees')
export class Employee {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, comment: '사번' })
    employeeNumber: string;

    @Column({ comment: '이름' })
    name: string;

    @Column({ unique: true, comment: '이메일', nullable: true })
    email?: string;

    @Column({ comment: '비밀번호', nullable: true })
    password?: string;

    @Column({ comment: '전화번호', nullable: true })
    phoneNumber?: string;

    @Column({ comment: '생년월일', type: 'date', nullable: true })
    dateOfBirth?: Date;

    @Column({
        comment: '성별',
        type: 'enum',
        enum: Gender,
        nullable: true,
    })
    gender?: Gender;

    @Column({ comment: '입사일', type: 'date' })
    hireDate: Date;

    @Column({
        comment: '재직 상태',
        type: 'enum',
        enum: EmployeeStatus,
        default: EmployeeStatus.Active,
    })
    status: EmployeeStatus;

    // 부서, 직책 관계는 중간테이블로 분리
    // 직급은 현재 상태 + 이력 관리 혼합 방식

    @Column({ comment: '현재 직급 ID', type: 'uuid', nullable: true })
    currentRankId?: string;

    @ManyToOne(() => Rank, { eager: true })
    @JoinColumn({ name: 'currentRankId' })
    currentRank?: Rank;

    @Column({ comment: '퇴사일', type: 'date', nullable: true })
    terminationDate?: Date;

    @Column({ comment: '퇴사 사유', type: 'text', nullable: true })
    terminationReason?: string;

    @Column({ comment: '메타데이터', type: 'jsonb', nullable: true })
    metadata?: Record<string, any>;

    @Column({ comment: '초기 비밀번호 설정 여부', default: false })
    isInitialPasswordSet: boolean;

    // 매니저 관계는 EmployeeDepartmentPosition에서 관리
    @OneToMany(() => EmployeeDepartmentPosition, (edp) => edp.employee)
    departmentPositions?: EmployeeDepartmentPosition[];

    // FCM 토큰 관계 (중간테이블을 통한 관리)
    @OneToMany(() => EmployeeFcmToken, (eft) => eft.employee)
    fcmTokens?: EmployeeFcmToken[];

    @CreateDateColumn({ comment: '생성일' })
    createdAt: Date;

    @UpdateDateColumn({ comment: '수정일' })
    updatedAt: Date;

    // ==================== Setter 메서드 ====================

    /**
     * 사번을설정한다
     */
    사번을설정한다(employeeNumber: string): void {
        this.employeeNumber = employeeNumber;
    }

    /**
     * 이름을설정한다
     */
    이름을설정한다(name: string): void {
        this.name = name;
    }

    /**
     * 이메일을설정한다
     */
    이메일을설정한다(email: string): void {
        this.email = email;
    }

    /**
     * 비밀번호를설정한다
     */
    비밀번호를설정한다(password: string): void {
        this.password = password;
    }

    /**
     * 전화번호를설정한다
     */
    전화번호를설정한다(phoneNumber: string): void {
        this.phoneNumber = phoneNumber;
    }

    /**
     * 생년월일을설정한다
     */
    생년월일을설정한다(dateOfBirth: Date): void {
        this.dateOfBirth = dateOfBirth;
    }

    /**
     * 성별을설정한다
     */
    성별을설정한다(gender: Gender): void {
        this.gender = gender;
    }

    /**
     * 입사일을설정한다
     */
    입사일을설정한다(hireDate: Date): void {
        this.hireDate = hireDate;
    }

    /**
     * 현재직급을설정한다
     */
    현재직급을설정한다(currentRankId: string): void {
        this.currentRankId = currentRankId;
    }

    /**
     * 메타데이터를설정한다
     */
    메타데이터를설정한다(metadata: Record<string, any>): void {
        this.metadata = metadata;
    }

    /**
     * 활성화한다
     */
    활성화한다(): void {
        this.status = EmployeeStatus.Active;
    }

    /**
     * 휴직처리한다
     */
    휴직처리한다(): void {
        this.status = EmployeeStatus.Leave;
    }

    /**
     * 퇴사처리한다
     */
    퇴사처리한다(terminationDate: Date, terminationReason?: string): void {
        this.status = EmployeeStatus.Terminated;
        this.terminationDate = terminationDate;
        this.terminationReason = terminationReason;
    }

    /**
     * 초기비밀번호를설정완료한다
     */
    초기비밀번호를설정완료한다(): void {
        this.isInitialPasswordSet = true;
    }
}
