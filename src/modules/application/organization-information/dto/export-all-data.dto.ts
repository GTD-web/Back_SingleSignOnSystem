import { ApiProperty } from '@nestjs/swagger';

export class ExportDepartmentDto {
    @ApiProperty({ description: '부서 ID' })
    id: string;

    @ApiProperty({ description: '부서명' })
    departmentName: string;

    @ApiProperty({ description: '부서 코드' })
    departmentCode: string;

    @ApiProperty({ description: '부서 유형' })
    type: string;

    @ApiProperty({ description: '상위 부서 ID', required: false })
    parentDepartmentId?: string;

    @ApiProperty({ description: '정렬 순서' })
    order: number;

    @ApiProperty({ description: '생성일' })
    createdAt: Date;

    @ApiProperty({ description: '수정일' })
    updatedAt: Date;
}

export class ExportEmployeeDto {
    @ApiProperty({ description: '직원 ID' })
    id: string;

    @ApiProperty({ description: '사번' })
    employeeNumber: string;

    @ApiProperty({ description: '이름' })
    name: string;

    @ApiProperty({ description: '이메일', required: false })
    email?: string;

    @ApiProperty({ description: '비밀번호', required: false })
    password?: string;

    @ApiProperty({ description: '전화번호', required: false })
    phoneNumber?: string;

    @ApiProperty({ description: '생년월일', required: false })
    dateOfBirth?: Date;

    @ApiProperty({ description: '성별', required: false })
    gender?: string;

    @ApiProperty({ description: '입사일' })
    hireDate: Date;

    @ApiProperty({ description: '재직 상태' })
    status: string;

    @ApiProperty({ description: '현재 직급 ID', required: false })
    currentRankId?: string;

    @ApiProperty({ description: '퇴사일', required: false })
    terminationDate?: Date;

    @ApiProperty({ description: '퇴사 사유', required: false })
    terminationReason?: string;

    @ApiProperty({ description: '초기 비밀번호 설정 여부' })
    isInitialPasswordSet: boolean;

    @ApiProperty({ description: '생성일' })
    createdAt: Date;

    @ApiProperty({ description: '수정일' })
    updatedAt: Date;
}

export class ExportPositionDto {
    @ApiProperty({ description: '직책 ID' })
    id: string;

    @ApiProperty({ description: '직책명' })
    positionTitle: string;

    @ApiProperty({ description: '직책 코드' })
    positionCode: string;

    @ApiProperty({ description: '직책 레벨' })
    level: number;

    @ApiProperty({ description: '관리 권한 여부' })
    hasManagementAuthority: boolean;
}

export class ExportRankDto {
    @ApiProperty({ description: '직급 ID' })
    id: string;

    @ApiProperty({ description: '직급명' })
    rankName: string;

    @ApiProperty({ description: '직급 코드' })
    rankCode: string;

    @ApiProperty({ description: '직급 레벨' })
    level: number;
}

export class ExportEmployeeDepartmentPositionDto {
    @ApiProperty({ description: 'ID' })
    id: string;

    @ApiProperty({ description: '직원 ID' })
    employeeId: string;

    @ApiProperty({ description: '부서 ID' })
    departmentId: string;

    @ApiProperty({ description: '직책 ID' })
    positionId: string;

    @ApiProperty({ description: '관리자 권한 여부' })
    isManager: boolean;

    @ApiProperty({ description: '생성일' })
    createdAt: Date;

    @ApiProperty({ description: '수정일' })
    updatedAt: Date;
}

export class ExportAssignmentHistoryDto {
    @ApiProperty({ description: '이력 ID' })
    historyId: string;

    @ApiProperty({ description: '직원 ID' })
    employeeId: string;

    @ApiProperty({ description: '부서 ID' })
    departmentId: string;

    @ApiProperty({ description: '해당 시점의 상위 부서 ID', required: false })
    parentDepartmentId?: string;

    @ApiProperty({ description: '직책 ID' })
    positionId: string;

    @ApiProperty({ description: '직급 ID', required: false })
    rankId?: string;

    @ApiProperty({ description: '관리자 권한 여부' })
    isManager: boolean;

    @ApiProperty({ description: '효력 시작일' })
    effectiveStartDate: string;

    @ApiProperty({ description: '효력 종료일', required: false })
    effectiveEndDate?: string;

    @ApiProperty({ description: '현재 배치 여부' })
    isCurrent: boolean;

    @ApiProperty({ description: '배치 사유', required: false })
    assignmentReason?: string;

    @ApiProperty({ description: '생성일' })
    createdAt: Date;
}

export class ExportAllDataResponseDto {
    @ApiProperty({ description: '부서 목록', type: [ExportDepartmentDto] })
    departments: ExportDepartmentDto[];

    @ApiProperty({ description: '직원 목록', type: [ExportEmployeeDto] })
    employees: ExportEmployeeDto[];

    @ApiProperty({ description: '직책 목록', type: [ExportPositionDto] })
    positions: ExportPositionDto[];

    @ApiProperty({ description: '직급 목록', type: [ExportRankDto] })
    ranks: ExportRankDto[];

    @ApiProperty({ description: '직원-부서-직책 매핑 목록', type: [ExportEmployeeDepartmentPositionDto] })
    employeeDepartmentPositions: ExportEmployeeDepartmentPositionDto[];

    @ApiProperty({ description: '배치 이력 목록', type: [ExportAssignmentHistoryDto] })
    assignmentHistories: ExportAssignmentHistoryDto[];

    @ApiProperty({ description: '전체 데이터 개수' })
    totalCounts: {
        departments: number;
        employees: number;
        positions: number;
        ranks: number;
        employeeDepartmentPositions: number;
        assignmentHistories: number;
    };

    @ApiProperty({ description: '조회 시각' })
    exportedAt: Date;
}
