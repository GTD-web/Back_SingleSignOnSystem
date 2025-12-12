# 조직도 변경 이력 관리 설계 (SCD Type 2)

## 📋 목차

1. [개요](#개요)
2. [현재 구조 분석](#현재-구조-분석)
3. [SCD Type 2 적용 설계](#scd-type-2-적용-설계)
4. [SCD Type 2 구현 시 주의사항](#scd-type-2-구현-시-주의사항)
5. [데이터베이스 스키마](#데이터베이스-스키마)
6. [마이그레이션 전략](#마이그레이션-전략)
7. [성능 최적화](#성능-최적화)

---

## 개요

### 문제 상황

조직도(부서/직책) 변경이 잦은 환경에서 근태 기록과 같은 정보들의 정확성과 일관성 유지가 어려움

### 해결 방안

**Slowly Changing Dimension (SCD) Type 2** 방식을 적용하여 조직 정보의 변경 이력을 관리

### 핵심 원칙

-   조직도 정보는 **시간의 흐름에 따라 변하는 차원(Dimension)** 정보로 취급
-   근태 기록과 같은 **사실(Fact) 정보와 분리**하여 관리
-   모든 변경 시점의 **유효 기간(Effective Date Range)** 기록

---

## 현재 구조 분석

### 기존 엔티티 개요

```
Employee (직원)
├─ EmployeeDepartmentPosition (직원-부서-직책 매핑)
├─ Department (부서)
├─ Position (직책)
└─ Rank (직급)
```

### 기존 엔티티 상세

#### 1. Department (부서)

```typescript
// 📁 src/modules/domain/department/department.entity.ts

@Entity('departments')
@Unique('UQ_departments_parent_order', ['parentDepartmentId', 'order'])
@Index('IDX_departments_parent_order', ['parentDepartmentId', 'order'])
export class Department {
    @PrimaryColumn({ type: 'uuid', comment: '부서 ID (외부 제공)' })
    id: string;

    @Column({ comment: '부서명' })
    departmentName: string;

    @Column({ unique: true, comment: '부서 코드' })
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

    // 부서 계층 구조
    @ManyToOne(() => Department, (department) => department.childDepartments, { nullable: true })
    @JoinColumn({ name: 'parentDepartmentId' })
    parentDepartment?: Department;

    @OneToMany(() => Department, (department) => department.parentDepartment)
    childDepartments: Department[];

    @CreateDateColumn({ comment: '생성일' })
    createdAt: Date;

    @UpdateDateColumn({ comment: '수정일' })
    updatedAt: Date;
}
```

**특징:**

-   계층 구조 지원 (`parentDepartmentId`)
-   부서 타입 구분 (`DepartmentType` enum)
-   정렬 순서 관리 (`order`)

#### 2. Position (직책)

```typescript
// 📁 src/modules/domain/position/position.entity.ts

@Entity('positions')
export class Position {
    @PrimaryColumn({ type: 'uuid', comment: '직책 ID (외부 제공)' })
    id: string;

    @Column({ comment: '직책명 (예: 부서장, 파트장, 팀장, 직원)' })
    positionTitle: string;

    @Column({ unique: true, comment: '직책 코드' })
    positionCode: string;

    @Column({ comment: '직책 레벨 (낮을수록 상위 직책)' })
    level: number;

    @Column({ comment: '관리 권한 여부', default: false })
    hasManagementAuthority: boolean;

    @CreateDateColumn({ comment: '생성일' })
    createdAt: Date;

    @UpdateDateColumn({ comment: '수정일' })
    updatedAt: Date;
}
```

**특징:**

-   직책 레벨 관리
-   관리 권한 플래그

#### 3. Rank (직급)

```typescript
// 📁 src/modules/domain/rank/rank.entity.ts

@Entity('ranks')
export class Rank {
    @PrimaryColumn({ type: 'uuid', comment: '직급 ID (외부 제공)' })
    id: string;

    @Column({ comment: '직급명 (예: 사원, 주임, 대리, 과장, 차장, 부장)' })
    rankTitle: string;

    @Column({ unique: true, comment: '직급 코드' })
    rankCode: string;

    @Column({ comment: '직급 레벨 (낮을수록 상위 직급)' })
    level: number;

    @CreateDateColumn({ comment: '생성일' })
    createdAt: Date;

    @UpdateDateColumn({ comment: '수정일' })
    updatedAt: Date;
}
```

**특징:**

-   직급 레벨로 위계 관리
-   독립적인 마스터 데이터

#### 4. EmployeeDepartmentPosition (직원-부서-직책 매핑)

```typescript
// 📁 src/modules/domain/employee-department-position/employee-department-position.entity.ts

@Entity('employee_department_positions')
@Unique(['employeeId', 'departmentId']) // 한 직원이 같은 부서에서는 하나의 직책만 가능
@Index(['employeeId'])
@Index(['departmentId'])
@Index(['positionId'])
export class EmployeeDepartmentPosition {
    @PrimaryColumn({ type: 'uuid', comment: '직원-부서-직책 ID (외부 제공)' })
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
    @ManyToOne(() => Employee, { eager: false })
    @JoinColumn({ name: 'employeeId' })
    employee: Employee;

    @ManyToOne(() => Department, { eager: false })
    @JoinColumn({ name: 'departmentId' })
    department: Department;

    @ManyToOne(() => Position, { eager: false })
    @JoinColumn({ name: 'positionId' })
    position: Position;
}
```

**특징:**

-   직원-부서-직책의 N:M:P 관계 해소
-   한 직원이 같은 부서에서 하나의 직책만 가능
-   **이력 관리 없음** (현재 시점만 저장)

#### 5. Employee (직원) - 조직 관련 필드만

```typescript
@Entity('employees')
export class Employee {
    @PrimaryColumn({ type: 'uuid' })
    id: string;

    @Column({ unique: true })
    employeeNumber: string;

    @Column()
    name: string;

    @Column({ type: 'date' })
    hireDate: Date; // 입사일

    @Column({ type: 'date', nullable: true })
    terminationDate?: Date; // 퇴사일

    // 직급 관계
    @Column({ type: 'uuid', nullable: true })
    currentRankId?: string;

    @ManyToOne(() => Rank, { eager: true })
    @JoinColumn({ name: 'currentRankId' })
    currentRank?: Rank;

    // 부서-직책 관계
    @OneToMany(() => EmployeeDepartmentPosition, (edp) => edp.employee)
    departmentPositions?: EmployeeDepartmentPosition[];

    // ... 기타 필드
}
```

**특징:**

-   `currentRankId`는 Employee에 직접 저장 (1:1 관계)
-   부서-직책은 별도 테이블로 관리 (1:N 관계)
-   입사일/퇴사일 관리

### 현재 구조의 문제점

1. **`EmployeeDepartmentPosition`**: 현재 시점의 배치만 저장 (이력 없음)
    - 직원이 부서를 이동하면 기존 데이터가 업데이트되어 과거 소속 부서 추적 불가
2. **`Department`**: 부서 구조 변경 이력 없음
    - 부서 통폐합, 이름 변경 시 과거 조직 구조 재현 불가
3. **시점 기반 조회 불가**: 특정 날짜의 조직 상태를 알 수 없음
    - "2024년 3월 당시 A부서 소속 직원" 같은 쿼리 불가능
4. **데이터 정합성**: 과거 근태 기록의 조직 정보가 현재 정보로 덮어씌워짐

    - 근태 스냅샷을 생성해도 조직 정보는 현재 기준으로만 조회됨

5. **Rank는 Employee에 직접 연결**:
    - EmployeeDepartmentPosition에는 없어서 이력 관리 시 별도 고려 필요

---

## SCD Type 2 적용 설계

### 1. 부서 이력 관리 (DepartmentHistory)

#### 엔티티 정의

```typescript
// 📁 src/modules/domain/department-history/department-history.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Department } from '../department/department.entity';
import { DepartmentType } from '../../../common/enums/department.enum';

@Entity('department_history')
@Index(['departmentId', 'effectiveStartDate'])
@Index(['effectiveStartDate', 'effectiveEndDate'])
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

    // 현재 유효한 레코드인지 빠르게 판단
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

    // 원본 Department와의 관계 (읽기 전용)
    @ManyToOne(() => Department)
    @JoinColumn({ name: 'departmentId' })
    department: Department;
}
```

#### 사용 예시

```typescript
import { subDays, format } from 'date-fns';

// 부서 정보 변경 시
async updateDepartment(departmentId: string, newData: UpdateDepartmentDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
        // ⚠️ 중요: 날짜 범위 중복 방지
        // effectiveEndDate는 새로운 effectiveStartDate의 하루 전이어야 함
        const newStartDate = new Date(newData.effectiveDate || new Date());
        const previousEndDate = format(subDays(newStartDate, 1), 'yyyy-MM-dd');

        // 1. 기존 현재 레코드의 유효 종료일 설정
        await queryRunner.manager.update(
            DepartmentHistory,
            {
                departmentId,
                isCurrent: true
            },
            {
                effectiveEndDate: previousEndDate, // 하루 전으로 설정
                isCurrent: false
            }
        );

        // 2. 새 이력 레코드 생성
        const newHistory = queryRunner.manager.create(DepartmentHistory, {
            departmentId,
            departmentName: newData.departmentName,
            departmentCode: newData.departmentCode,
            type: newData.type,
            parentDepartmentId: newData.parentDepartmentId,
            order: newData.order,
            effectiveStartDate: format(newStartDate, 'yyyy-MM-dd'),
            effectiveEndDate: null,
            isCurrent: true,
            changeReason: newData.changeReason,
            changedBy: newData.userId,
        });

        await queryRunner.manager.save(newHistory);

        // 3. 원본 Department 테이블도 업데이트
        await queryRunner.manager.update(Department, departmentId, newData);

        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }
}
```

---

### 2. 직원-부서-직책 이력 관리

#### 엔티티 정의

```typescript
// 📁 src/modules/domain/employee-department-position-history/employee-department-position-history.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { Department } from '../department/department.entity';
import { Position } from '../position/position.entity';
import { Rank } from '../rank/rank.entity';

@Entity('employee_department_position_history')
@Index(['employeeId', 'effectiveStartDate', 'effectiveEndDate'])
@Index(['departmentId', 'effectiveStartDate', 'effectiveEndDate'])
@Index(['isCurrent', 'employeeId'])
export class EmployeeDepartmentPositionHistory {
    @PrimaryGeneratedColumn('uuid')
    historyId: string;

    @Column({ comment: '직원 ID', type: 'uuid' })
    employeeId: string;

    @Column({ comment: '부서 ID', type: 'uuid' })
    departmentId: string;

    @Column({ comment: '직책 ID', type: 'uuid' })
    positionId: string;

    @Column({ comment: '직급 ID', type: 'uuid', nullable: true })
    rankId?: string;

    @Column({ comment: '관리자 권한 여부', type: 'boolean', default: false })
    isManager: boolean;

    // ✨ SCD Type 2: 유효 기간
    @Column({
        type: 'date',
        comment: '발령 시작일 (이 배치가 유효해진 날짜)',
    })
    effectiveStartDate: string;

    @Column({
        type: 'date',
        nullable: true,
        comment: '발령 종료일 (NULL = 현재 유효)',
    })
    effectiveEndDate: string | null;

    @Column({
        type: 'boolean',
        default: true,
        comment: '현재 유효한 배치 여부',
    })
    isCurrent: boolean;

    // 배치 메타데이터
    @Column({
        type: 'text',
        nullable: true,
        comment: '발령 사유 (인사이동, 승진, 조직개편 등)',
    })
    assignmentReason?: string;

    @Column({
        type: 'uuid',
        nullable: true,
        comment: '발령자 ID',
    })
    assignedBy?: string;

    @CreateDateColumn({ comment: '이력 생성 시각' })
    createdAt: Date;

    // Relations
    @ManyToOne(() => Employee, { eager: false })
    @JoinColumn({ name: 'employeeId' })
    employee: Employee;

    @ManyToOne(() => Department, { eager: false })
    @JoinColumn({ name: 'departmentId' })
    department: Department;

    @ManyToOne(() => Position, { eager: false })
    @JoinColumn({ name: 'positionId' })
    position: Position;

    @ManyToOne(() => Rank, { eager: false, nullable: true })
    @JoinColumn({ name: 'rankId' })
    rank?: Rank;
}
```

#### 사용 예시

```typescript
import { subDays, format } from 'date-fns';

// 직원 인사 발령
async assignEmployee(dto: AssignEmployeeDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
        // ⚠️ 중요: 날짜 범위 중복 방지
        // effectiveEndDate는 새로운 effectiveStartDate의 하루 전이어야 함
        const newStartDate = new Date(dto.effectiveDate);
        const previousEndDate = format(subDays(newStartDate, 1), 'yyyy-MM-dd');

        // 1. 기존 현재 배치의 유효 종료일 설정
        await queryRunner.manager.update(
            EmployeeDepartmentPositionHistory,
            {
                employeeId: dto.employeeId,
                isCurrent: true
            },
            {
                effectiveEndDate: previousEndDate, // 하루 전으로 설정
                isCurrent: false
            }
        );

        // 2. 새 배치 이력 생성
        const newAssignment = queryRunner.manager.create(
            EmployeeDepartmentPositionHistory,
            {
                employeeId: dto.employeeId,
                departmentId: dto.departmentId,
                positionId: dto.positionId,
                rankId: dto.rankId,
                isManager: dto.isManager,
                effectiveStartDate: dto.effectiveDate,
                effectiveEndDate: null,
                isCurrent: true,
                assignmentReason: dto.reason,
                assignedBy: dto.assignedBy,
            }
        );

        await queryRunner.manager.save(newAssignment);

        // 3. 원본 EmployeeDepartmentPosition 업데이트는 불필요
        // History 테이블의 isCurrent = true 레코드가 현재 배치를 대표하므로
        // EmployeeDepartmentPosition 테이블은 삭제 권고 (아래 주의사항 참조)

        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }
}
```

---

### 3. 조직 스냅샷 서비스

#### 서비스 정의

```typescript
// 📁 src/modules/domain/organization-snapshot/organization-snapshot.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentHistory } from '../department-history/department-history.entity';
import { EmployeeDepartmentPositionHistory } from '../employee-department-position-history/employee-department-position-history.entity';

@Injectable()
export class OrganizationSnapshotService {
    constructor(
        @InjectRepository(DepartmentHistory)
        private departmentHistoryRepo: Repository<DepartmentHistory>,
        @InjectRepository(EmployeeDepartmentPositionHistory)
        private empDeptPosHistoryRepo: Repository<EmployeeDepartmentPositionHistory>,
    ) {}

    /**
     * 특정 시점의 조직도 전체 조회
     * ⚠️ 부서 계층 구조 재현을 위해 Self-Join 사용
     */
    async getOrganizationAtDate(targetDate: string) {
        // 1. 해당 시점에 유효했던 부서들 (계층 구조 포함)
        // Self-Join을 통해 상위 부서의 해당 시점 정보도 함께 조회
        const departments = await this.departmentHistoryRepo
            .createQueryBuilder('dh_child')
            .leftJoinAndMapOne(
                'dh_child.parentDepartmentHistory',
                DepartmentHistory,
                'dh_parent',
                `dh_child.parent_department_id = dh_parent.department_id 
                AND dh_parent.effective_start_date <= :targetDate 
                AND (dh_parent.effective_end_date IS NULL OR dh_parent.effective_end_date > :targetDate)`,
            )
            .where('dh_child.effectiveStartDate <= :targetDate', { targetDate })
            .andWhere('(dh_child.effectiveEndDate IS NULL OR dh_child.effectiveEndDate > :targetDate)', { targetDate })
            .setParameter('targetDate', targetDate)
            .getMany();

        // 2. 해당 시점에 유효했던 직원 배치
        const assignments = await this.empDeptPosHistoryRepo
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
     * 특정 직원의 조직 이동 이력
     */
    async getEmployeeAssignmentHistory(employeeId: string) {
        return this.empDeptPosHistoryRepo
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.department', 'dept')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.employeeId = :employeeId', { employeeId })
            .orderBy('eh.effectiveStartDate', 'DESC')
            .getMany();
    }

    /**
     * 특정 부서의 인원 변동 이력
     */
    async getDepartmentAssignmentHistory(departmentId: string) {
        return this.empDeptPosHistoryRepo
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.employee', 'emp')
            .leftJoinAndSelect('eh.position', 'pos')
            .where('eh.departmentId = :departmentId', { departmentId })
            .orderBy('eh.effectiveStartDate', 'DESC')
            .getMany();
    }

    /**
     * 특정 직원의 특정 시점 조직 정보
     */
    async getEmployeeOrgAtDate(employeeId: string, targetDate: string) {
        return this.empDeptPosHistoryRepo
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.department', 'dept')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.employeeId = :employeeId', { employeeId })
            .andWhere('eh.effectiveStartDate <= :targetDate', { targetDate })
            .andWhere('(eh.effectiveEndDate IS NULL OR eh.effectiveEndDate > :targetDate)', { targetDate })
            .getOne();
    }

    /**
     * 현재 유효한 조직도 (성능 최적화)
     */
    async getCurrentOrganization() {
        const departments = await this.departmentHistoryRepo.find({
            where: { isCurrent: true },
        });

        const assignments = await this.empDeptPosHistoryRepo
            .createQueryBuilder('eh')
            .leftJoinAndSelect('eh.employee', 'emp')
            .leftJoinAndSelect('eh.department', 'dept')
            .leftJoinAndSelect('eh.position', 'pos')
            .leftJoinAndSelect('eh.rank', 'rank')
            .where('eh.isCurrent = :isCurrent', { isCurrent: true })
            .getMany();

        return {
            departments,
            assignments,
        };
    }
}
```

---

## SCD Type 2 구현 시 주의사항

### 🚨 1. 날짜 범위 중복 방지 (가장 중요)

#### 문제 상황

SCD Type 2의 핵심은 **유효 기간(Effective Date Range)이 절대 중복되지 않는 것**입니다.

잘못된 구현 예시:

```typescript
// ❌ 잘못된 예: 날짜가 중복될 수 있음
await queryRunner.manager.update(
    EmployeeDepartmentPositionHistory,
    { employeeId: dto.employeeId, isCurrent: true },
    {
        effectiveEndDate: '2025-03-01', // 👈 문제
        isCurrent: false,
    },
);

const newAssignment = queryRunner.manager.create(EmployeeDepartmentPositionHistory, {
    // ...
    effectiveStartDate: '2025-03-01', // 👈 문제: 같은 날짜
    // ...
});
```

**문제점**: `2025-03-01` 날짜를 조회하면 두 레코드가 모두 유효한 상태로 조회될 수 있어 데이터 정합성을 해칩니다.

#### ✅ 올바른 구현

`effectiveEndDate`는 새로운 `effectiveStartDate`의 **하루 전**이어야 합니다.

```typescript
import { subDays, format } from 'date-fns';

// ✅ 올바른 예: 1일 차이 적용
const newStartDate = new Date('2025-03-01');
const previousEndDate = format(subDays(newStartDate, 1), 'yyyy-MM-dd'); // '2025-02-28'

await queryRunner.manager.update(
    EmployeeDepartmentPositionHistory,
    { employeeId: dto.employeeId, isCurrent: true },
    {
        effectiveEndDate: previousEndDate, // '2025-02-28'
        isCurrent: false,
    },
);

const newAssignment = queryRunner.manager.create(EmployeeDepartmentPositionHistory, {
    // ...
    effectiveStartDate: '2025-03-01',
    // ...
});
```

**결과**:

-   이전 레코드: `effectiveStartDate ~ 2025-02-28`
-   새 레코드: `2025-03-01 ~ NULL`
-   **날짜 범위가 겹치지 않음 ✅**

#### 데이터베이스 제약 조건 추가

날짜 범위 중복을 방지하기 위한 체크 제약 조건:

```sql
-- PostgreSQL: 유효 기간 중복 체크 (ExclusionConstraint)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE employee_department_position_history
ADD CONSTRAINT no_overlapping_periods
EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_start_date, effective_end_date, '[]') WITH &&
);
```

### 🧩 2. 조직 계층 구조의 이력 추적

#### 문제 상황

`DepartmentHistory` 테이블의 `parentDepartmentId` 필드는 원본 `departments.id`를 참조합니다.

상위 부서(A)가 변경되면서 동시에 하위 부서(B)의 근태 기록을 조회할 때, **과거 시점의 정확한 계층 구조를 재현하기 어렵다**는 문제가 있습니다.

#### ✅ 해결 방법: Self-Join 활용

`DepartmentHistory` 테이블을 자기 자신과 `parentDepartmentId`로 조인하되, **조인 조건에도 `targetDate`의 유효 범위를 적용**합니다.

```sql
-- 특정 시점의 부서 계층 구조 조회 (Self-Join)
SELECT
    dh_child.history_id as child_history_id,
    dh_child.department_name as child_department_name,
    dh_child.department_code as child_department_code,
    dh_parent.department_name as parent_department_name,
    dh_parent.department_code as parent_department_code
FROM department_history dh_child
LEFT JOIN department_history dh_parent
    ON dh_child.parent_department_id = dh_parent.department_id
    AND dh_parent.effective_start_date <= :targetDate
    AND (dh_parent.effective_end_date IS NULL OR dh_parent.effective_end_date > :targetDate)
WHERE dh_child.effective_start_date <= :targetDate
    AND (dh_child.effective_end_date IS NULL OR dh_child.effective_end_date > :targetDate);
```

TypeORM에서는 `leftJoinAndMapOne`을 사용합니다 (위의 `getOrganizationAtDate` 예시 참조).

#### 대안: parentDepartmentHistoryId 추가

더 복잡하지만 명시적인 방법으로, `DepartmentHistory`에 `parentDepartmentHistoryId` (상위 부서의 이력 ID) 필드를 추가할 수도 있습니다.

**장점**: 조인이 단순해짐
**단점**: 데이터 유지보수가 복잡해짐 (부서 변경 시 하위 부서들도 모두 업데이트 필요)

**권장**: Self-Join 방식 사용 (현재 설계)

### 📊 3. 핵심 엔티티와의 관계 정리

#### Department 테이블: Soft Delete 추가

부서가 폐지되어도 이력 테이블의 FK 무결성을 보존하기 위해 **Soft Delete** 적용을 권장합니다.

```typescript
@Entity('departments')
export class Department {
    // ... 기존 필드

    @Column({ comment: '삭제 여부', default: false })
    isDeleted: boolean;

    @Column({ comment: '삭제일', type: 'timestamp', nullable: true })
    deletedAt?: Date;
}
```

```sql
-- Soft Delete용 인덱스
CREATE INDEX idx_departments_not_deleted
ON departments(id)
WHERE is_deleted = false;
```

#### EmployeeDepartmentPosition 테이블: 삭제 권고 ⚠️

`EmployeeDepartmentPositionHistory`가 `isCurrent = true`인 레코드를 통해 현재 배치를 완벽히 대체하므로, **원본 `EmployeeDepartmentPosition` 테이블은 삭제를 권장**합니다.

**이유**:

1. 데이터 중복 방지
2. 단일 진실 공급원(Single Source of Truth) 유지
3. 동기화 이슈 제거

**대안**:

-   `EmployeeDepartmentPosition` 테이블 삭제
-   `current_organization` Materialized View 또는 `isCurrent = true` 쿼리로 현재 데이터 조회

```sql
-- Materialized View로 현재 조직도 제공
CREATE MATERIALIZED VIEW current_organization AS
SELECT
    edph.employee_id,
    edph.department_id,
    edph.position_id,
    edph.rank_id,
    edph.is_manager,
    e.name as employee_name,
    d.department_name,
    p.position_title,
    r.rank_title
FROM employee_department_position_history edph
JOIN employees e ON edph.employee_id = e.id
JOIN departments d ON edph.department_id = d.id
JOIN positions p ON edph.position_id = p.id
LEFT JOIN ranks r ON edph.rank_id = r.id
WHERE edph.is_current = true;

-- 정기 리프레시 (크론 작업 또는 트리거)
REFRESH MATERIALIZED VIEW CONCURRENTLY current_organization;
```

#### Rank 관리

현재 `Employee.currentRankId`는 Employee에 직접 연결되어 있습니다.

**옵션 1**: Rank도 History에 포함 (권장 ✅)

-   `EmployeeDepartmentPositionHistory.rankId` 사용 (이미 포함됨)
-   직급 변동도 이력으로 관리

**옵션 2**: Employee.currentRankId 유지

-   단순한 직급 관리만 필요한 경우
-   Rank 변경 이력이 불필요한 경우

### ✅ 4. 검증 로직 추가

#### 유효 기간 중복 체크

```typescript
// 서비스 레이어에서 중복 체크
async validateNoOverlap(employeeId: string, startDate: string, endDate: string | null) {
    const overlaps = await this.empDeptPosHistoryRepo
        .createQueryBuilder('eh')
        .where('eh.employeeId = :employeeId', { employeeId })
        .andWhere('eh.effectiveStartDate < :endDate', {
            endDate: endDate || '9999-12-31'
        })
        .andWhere('(eh.effectiveEndDate IS NULL OR eh.effectiveEndDate > :startDate)', {
            startDate
        })
        .getCount();

    if (overlaps > 0) {
        throw new Error('유효 기간이 기존 이력과 중복됩니다.');
    }
}
```

#### 현재 유효 레코드 유일성 체크

```sql
-- 각 직원은 정확히 하나의 현재 유효 배치만 가져야 함
SELECT employee_id, COUNT(*) as current_count
FROM employee_department_position_history
WHERE is_current = true
GROUP BY employee_id
HAVING COUNT(*) != 1;
```

---

## 데이터베이스 스키마

### 1. DepartmentHistory 테이블

```sql
CREATE TABLE department_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL,
    department_name VARCHAR(255) NOT NULL,
    department_code VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    parent_department_id UUID,
    "order" INTEGER DEFAULT 0,
    effective_start_date DATE NOT NULL,
    effective_end_date DATE,
    is_current BOOLEAN DEFAULT true,
    change_reason TEXT,
    changed_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 외래 키
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (changed_by) REFERENCES employees(id)
);

-- 인덱스
CREATE INDEX idx_dept_hist_id_dates
ON department_history(department_id, effective_start_date);

CREATE INDEX idx_dept_hist_dates
ON department_history(effective_start_date, effective_end_date);

CREATE INDEX idx_dept_hist_current
ON department_history(is_current)
WHERE is_current = true;
```

### 2. EmployeeDepartmentPositionHistory 테이블

```sql
CREATE TABLE employee_department_position_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    department_id UUID NOT NULL,
    position_id UUID NOT NULL,
    rank_id UUID,
    is_manager BOOLEAN DEFAULT false,
    effective_start_date DATE NOT NULL,
    effective_end_date DATE,
    is_current BOOLEAN DEFAULT true,
    assignment_reason TEXT,
    assigned_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 외래 키
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (position_id) REFERENCES positions(id),
    FOREIGN KEY (rank_id) REFERENCES ranks(id),
    FOREIGN KEY (assigned_by) REFERENCES employees(id)
);

-- 인덱스
CREATE INDEX idx_emp_dept_pos_hist_emp_dates
ON employee_department_position_history(
    employee_id,
    effective_start_date,
    effective_end_date
);

CREATE INDEX idx_emp_dept_pos_hist_dept_dates
ON employee_department_position_history(
    department_id,
    effective_start_date,
    effective_end_date
);

CREATE INDEX idx_emp_dept_pos_hist_current
ON employee_department_position_history(is_current, employee_id)
WHERE is_current = true;
```

---

## 마이그레이션 전략

### 단계 1: 새 테이블 생성

위의 [데이터베이스 스키마](#데이터베이스-스키마) 참조

### 단계 2: 기존 데이터 마이그레이션

#### 2-1. Department → DepartmentHistory

```sql
INSERT INTO department_history (
    department_id,
    department_name,
    department_code,
    type,
    parent_department_id,
    "order",
    effective_start_date,
    effective_end_date,
    is_current,
    change_reason
)
SELECT
    id,
    department_name,
    department_code,
    type,
    parent_department_id,
    "order",
    COALESCE(created_at::date, '2020-01-01'), -- 생성일을 유효 시작일로
    NULL, -- 현재 유효
    true,
    '초기 데이터 마이그레이션'
FROM departments;
```

#### 2-2. EmployeeDepartmentPosition → History

```sql
-- Rank 정보를 Employee 테이블에서 가져와서 함께 마이그레이션
INSERT INTO employee_department_position_history (
    employee_id,
    department_id,
    position_id,
    rank_id,
    is_manager,
    effective_start_date,
    effective_end_date,
    is_current,
    assignment_reason
)
SELECT
    edp.employee_id,
    edp.department_id,
    edp.position_id,
    e.current_rank_id, -- Employee 테이블에서 직급 정보 가져오기
    edp.is_manager,
    COALESCE(edp.created_at::date, e.hire_date, '2020-01-01'), -- 생성일 또는 입사일
    NULL,
    true,
    '초기 데이터 마이그레이션'
FROM employee_department_positions edp
JOIN employees e ON edp.employee_id = e.id;
```

**주의사항**:

-   `Employee.currentRankId`가 이미 존재하는 경우 해당 값을 사용
-   `EmployeeDepartmentPosition`에는 `rank_id`가 없으므로 `Employee` 테이블과 JOIN 필요
-   향후 직급 변동도 이력으로 관리하려면 `EmployeeDepartmentPositionHistory.rankId`를 활용

### 단계 3: 애플리케이션 코드 배포

1. 새 엔티티 추가
2. 서비스 레이어 구현
3. 기존 코드에서 이력 테이블 사용하도록 수정

### 단계 4: 검증

```sql
-- 1. 모든 직원이 현재 유효한 배치를 가지고 있는지 확인
SELECT e.id, e.name,
       COUNT(edph.history_id) as current_assignments
FROM employees e
LEFT JOIN employee_department_position_history edph
    ON e.id = edph.employee_id AND edph.is_current = true
GROUP BY e.id, e.name
HAVING COUNT(edph.history_id) != 1;

-- 2. 유효 기간 중복 체크
SELECT employee_id, COUNT(*) as overlaps
FROM employee_department_position_history
WHERE effective_end_date IS NULL OR effective_end_date > CURRENT_DATE
GROUP BY employee_id
HAVING COUNT(*) > 1;
```

---

## 성능 최적화

### 1. 인덱스 전략

#### 복합 인덱스

```sql
-- 시점 조회에 최적화된 복합 인덱스
CREATE INDEX idx_emp_hist_date_range
ON employee_department_position_history(
    employee_id,
    effective_start_date,
    effective_end_date
)
WHERE is_current = true;

-- 부서별 집계 쿼리 최적화
CREATE INDEX idx_dept_hist_date_range
ON employee_department_position_history(
    department_id,
    effective_start_date
)
INCLUDE (employee_id, position_id);
```

#### 부분 인덱스

```sql
-- 현재 유효한 레코드만 인덱싱
CREATE INDEX idx_current_assignments
ON employee_department_position_history(employee_id, department_id)
WHERE is_current = true;
```

#### 정렬 최적화 인덱스

```sql
-- 직원별 이력 조회 시 시작일 기준 내림차순 정렬 최적화
CREATE INDEX idx_emp_dept_pos_hist_employee_start
ON employee_department_position_history(employee_id, effective_start_date DESC);

-- 부서별 이력 조회 시 시작일 기준 내림차순 정렬 최적화
CREATE INDEX idx_emp_dept_pos_hist_department_start
ON employee_department_position_history(department_id, effective_start_date DESC);

-- 부서 이력 조회 최적화
CREATE INDEX idx_dept_hist_department_start
ON department_history(department_id, effective_start_date DESC);
```

**활용 예시**:

```sql
-- 직원의 최근 이력 조회 (인덱스 활용)
SELECT * FROM employee_department_position_history
WHERE employee_id = 'xxx'
ORDER BY effective_start_date DESC
LIMIT 10;

-- 부서의 최근 변경 이력 조회 (인덱스 활용)
SELECT * FROM department_history
WHERE department_id = 'yyy'
ORDER BY effective_start_date DESC;
```

### 2. 파티셔닝

연도별 파티셔닝으로 대용량 이력 데이터 관리:

```sql
-- 부서 이력 테이블 파티셔닝 (PostgreSQL 10+)
CREATE TABLE department_history (
    -- ... 기존 컬럼들
) PARTITION BY RANGE (effective_start_date);

-- 연도별 파티션 생성
CREATE TABLE department_history_2024
PARTITION OF department_history
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE department_history_2025
PARTITION OF department_history
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

### 3. Materialized View

현재 유효한 조직도를 빠르게 조회:

```sql
CREATE MATERIALIZED VIEW current_organization AS
SELECT
    edph.employee_id,
    edph.department_id,
    edph.position_id,
    edph.rank_id,
    edph.is_manager,
    e.name as employee_name,
    e.employee_number,
    d.department_name,
    p.position_title,
    r.rank_title
FROM employee_department_position_history edph
JOIN employees e ON edph.employee_id = e.id
JOIN departments d ON edph.department_id = d.id
JOIN positions p ON edph.position_id = p.id
LEFT JOIN ranks r ON edph.rank_id = r.id
WHERE edph.is_current = true;

-- 인덱스
CREATE UNIQUE INDEX idx_current_org_employee
ON current_organization(employee_id);

CREATE INDEX idx_current_org_department
ON current_organization(department_id);

-- 정기 리프레시 (크론 작업 또는 트리거)
REFRESH MATERIALIZED VIEW CONCURRENTLY current_organization;
```

### 4. 쿼리 최적화 예시

#### AS-OF 조회 쿼리

```sql
-- 특정 시점의 조직도 조회 (인덱스 활용)
EXPLAIN ANALYZE
SELECT
    edph.*,
    e.name,
    d.department_name,
    p.position_title
FROM employee_department_position_history edph
JOIN employees e ON edph.employee_id = e.id
JOIN departments d ON edph.department_id = d.id
JOIN positions p ON edph.position_id = p.id
WHERE edph.effective_start_date <= '2024-12-31'
  AND (edph.effective_end_date IS NULL OR edph.effective_end_date > '2024-12-31');

-- Index Scan 사용 확인
```

#### 현재 조직도 조회 (Materialized View 활용)

```sql
-- 빠른 조회
SELECT * FROM current_organization
WHERE department_id = 'xxx';
```

### 5. 캐싱 전략

```typescript
// Redis 캐싱 예시
async getEmployeeOrgAtDate(employeeId: string, targetDate: string) {
    const cacheKey = `org:${employeeId}:${targetDate}`;

    // 캐시 확인
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    // DB 조회
    const result = await this.empDeptPosHistoryRepo
        .createQueryBuilder('eh')
        // ... 쿼리
        .getOne();

    // 캐싱 (1시간)
    await this.cacheManager.set(cacheKey, result, 3600);

    return result;
}
```

---

## 주요 이점

### 1. 데이터 정확성

-   ✅ 모든 시점의 조직 정보를 정확히 재현 가능
-   ✅ 과거 데이터의 왜곡 없음
-   ✅ 감사(Audit) 추적 완벽 지원

### 2. 분석 유연성

-   ✅ "2024년 1월 당시 A부서의 평균 근태 시간" 계산 가능
-   ✅ 부서 통폐합 전후 비교 분석
-   ✅ 직원 이동 경로 추적

### 3. 확장성

-   ✅ 데이터 증가에도 쿼리 성능 유지 (파티셔닝)
-   ✅ 새로운 조직 속성 추가 용이
-   ✅ 타임트래블 쿼리 지원

### 4. 유지보수성

-   ✅ 명확한 데이터 구조
-   ✅ 변경 이력 자동 관리
-   ✅ 디버깅 용이

---

## 다음 단계

### Phase 1: 데이터베이스 및 엔티티 구현

1. **데이터베이스 스키마 생성**

    - `department_history` 테이블 생성
    - `employee_department_position_history` 테이블 생성
    - 인덱스 및 제약 조건 추가 (날짜 범위 중복 방지)

2. **엔티티 구현**

    - `DepartmentHistory` 엔티티
    - `EmployeeDepartmentPositionHistory` 엔티티
    - `Department` 엔티티에 Soft Delete 추가

3. **데이터 마이그레이션**
    - 기존 데이터를 History 테이블로 이관
    - `rank_id` 포함하여 마이그레이션
    - 데이터 검증 (중복 체크, 유일성 체크)

### Phase 2: 서비스 및 비즈니스 로직

4. **OrganizationSnapshotService 구현**

    - 특정 시점 조직도 조회 (Self-Join 포함)
    - 직원 이력 조회
    - 부서 이력 조회
    - 유효 기간 중복 검증 로직

5. **이력 관리 서비스**
    - 부서 정보 변경 (날짜 범위 중복 방지)
    - 직원 발령 (날짜 범위 중복 방지)
    - 검증 로직 (유효 기간 중복, 현재 유효 레코드 유일성)

### Phase 3: 성능 최적화

6. **Materialized View 생성**

    - `current_organization` View
    - 정기 리프레시 스케줄 설정

7. **캐싱 전략**
    - Redis 캐시 설정
    - 조직도 조회 캐싱

### Phase 4: API 및 UI

8. **API 엔드포인트**

    - 조직 이력 조회 API
    - 특정 시점 조직도 API
    - 직원 배치 이력 API

9. **프론트엔드**
    - 조직 변경 이력 UI
    - 타임라인 뷰
    - 조직도 시점별 비교

### Phase 5: 테스트 및 검증

10. **테스트 코드**

    -   날짜 범위 중복 방지 테스트
    -   Self-Join 계층 구조 테스트
    -   유효 기간 검증 테스트
    -   이력 조회 성능 테스트

11. **원본 테이블 정리** (선택사항)
    -   `EmployeeDepartmentPosition` 테이블 삭제 고려
    -   기존 코드를 History 테이블 사용으로 전환

---

## 참고 자료

-   [Slowly Changing Dimensions (Kimball Group)](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-2/)
-   [PostgreSQL Temporal Tables](https://www.postgresql.org/docs/current/temporal-tables.html)
-   [TypeORM Advanced Topics](https://typeorm.io/advanced-topics)
