import { Gender, EmployeeStatus } from '../../../../../libs/common/enums';

/**
 * 직원 생성 컨텍스트 DTO
 * 직원 생성 시 필요한 모든 정보를 포함
 */
export class 직원생성ContextDto {
    /**
     * 사번 (선택, 미입력시 자동 생성)
     */
    employeeNumber?: string;

    /**
     * 이름 (필수)
     */
    name: string;

    /**
     * 이메일 (선택, 미입력시 자동 생성)
     */
    email?: string;

    /**
     * 영문 성 (선택)
     */
    englishLastName?: string;

    /**
     * 영문 이름 (선택)
     */
    englishFirstName?: string;

    /**
     * 전화번호 (선택)
     */
    phoneNumber?: string;

    /**
     * 생년월일 (선택)
     */
    dateOfBirth?: Date;

    /**
     * 성별 (선택)
     */
    gender?: Gender;

    /**
     * 입사일 (필수)
     */
    hireDate: Date;

    /**
     * 상태 (선택)
     */
    status?: EmployeeStatus;

    /**
     * 현재 직급 ID (선택)
     */
    currentRankId?: string;

    /**
     * 부서 ID (선택)
     */
    departmentId?: string;

    /**
     * 직책 ID (선택)
     */
    positionId?: string;

    /**
     * 관리자 여부 (선택, 기본값: false)
     */
    isManager?: boolean;
}
