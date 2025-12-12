/**
 * 직원 배치 생성 컨텍스트 DTO
 * 직원을 부서에 배치할 때 필요한 정보
 */
export class 직원배치생성ContextDto {
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
     * 관리자 여부 (선택, 기본값: false)
     */
    isManager?: boolean;
}
