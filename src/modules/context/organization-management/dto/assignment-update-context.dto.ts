/**
 * 직원 배치 수정 컨텍스트 DTO
 * 직원 배치 정보를 수정할 때 필요한 정보
 */
export class 직원배치수정ContextDto {
    /**
     * 부서 ID (선택)
     */
    departmentId?: string;

    /**
     * 직책 ID (선택)
     */
    positionId?: string;

    /**
     * 관리자 여부 (선택)
     */
    isManager?: boolean;
}
