/**
 * 직원 배치 이력 생성 컨텍스트 DTO
 * 직원 발령 이력을 생성할 때 필요한 정보
 */
export class 직원배치이력생성ContextDto {
    /**
     * 직원 ID (필수)
     */
    employeeId: string;

    /**
     * 부서 ID (필수)
     */
    departmentId: string;

    /**
     * 직책 ID (필수)
     */
    positionId: string;

    /**
     * 직급 ID (선택)
     */
    rankId?: string;

    /**
     * 관리자 여부 (필수)
     */
    isManager: boolean;

    /**
     * 발령 시작일 (필수)
     */
    effectiveDate: Date;

    /**
     * 발령 사유 (선택)
     */
    assignmentReason?: string;

    /**
     * 발령자 (선택)
     */
    assignedBy?: string;
}
