import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { DomainEmployeeRepository } from './employee.repository';
import { BaseService } from '../../../../libs/common/services/base.service';
import { Employee } from './employee.entity';
import { EmployeeStatus, Gender } from '../../../../libs/common/enums';
import { In, Not, Like } from 'typeorm';
import * as bcrypt from '@node-rs/bcrypt';

@Injectable()
export class DomainEmployeeService extends BaseService<Employee> {
    constructor(private readonly employeeRepository: DomainEmployeeRepository) {
        super(employeeRepository);
    }

    // 예시: 직원 ID로 찾기
    async findByEmployeeId(employeeId: string): Promise<Employee> {
        const employee = await this.employeeRepository.findOne({ where: { id: employeeId } });
        return employee;
    }
    // 필요에 따라 Employee 관련 메서드를 추가하세요.

    async findByEmail(email: string): Promise<Employee> {
        const employee = await this.employeeRepository.findOne({
            where: { email },
        });
        return employee;
    }

    async findByEmployeeNumber(employeeNumber: string): Promise<Employee> {
        const employee = await this.employeeRepository.findOne({ where: { employeeNumber } });
        return employee;
    }

    /**
     * 직원의 비밀번호를 업데이트합니다
     */
    async updatePassword(employeeId: string, hashedPassword: string): Promise<Employee> {
        return this.update(employeeId, { password: hashedPassword });
    }

    hashPassword(password: string = '1234'): string {
        return bcrypt.hashSync(password, 10);
    }

    async verifyPassword(password: string, employee: Employee): Promise<boolean> {
        return bcrypt.compare(password, employee.password);
    }

    /**
     * 다중 직원 데이터를 일괄 저장합니다
     */
    async bulkSave(employees: Employee[]): Promise<Employee[]> {
        const savedEmployees: Employee[] = [];
        for (const employee of employees) {
            const saved = await this.save(employee);
            savedEmployees.push(saved);
        }
        return savedEmployees;
    }

    /**
     * 여러 직원 ID로 직원들을 조회합니다
     */
    async findByEmployeeIds(employeeIds: string[], includeTerminated = false): Promise<Employee[]> {
        const where: any = { id: In(employeeIds) };

        if (!includeTerminated) {
            where.status = Not(EmployeeStatus.Terminated);
        }

        return this.employeeRepository.findAll({ where });
    }

    /**
     * 여러 사번으로 직원들을 조회합니다
     */
    async findByEmployeeNumbers(employeeNumbers: string[], includeTerminated = false): Promise<Employee[]> {
        const where: any = { employeeNumber: In(employeeNumbers) };

        if (!includeTerminated) {
            where.status = Not(EmployeeStatus.Terminated);
        }

        return this.employeeRepository.findAll({ where });
    }

    /**
     * 전체 직원을 조회합니다
     */
    async findAllEmployees(includeTerminated = false): Promise<Employee[]> {
        const where: any = {};

        if (!includeTerminated) {
            where.status = Not(EmployeeStatus.Terminated);
        }

        return this.employeeRepository.findAll({
            where,
            order: { employeeNumber: 'ASC' },
        });
    }

    /**
     * 재직상태별로 직원을 조회합니다
     */
    async findByStatus(status: EmployeeStatus): Promise<Employee[]> {
        return this.employeeRepository.findAll({
            where: { status },
            order: { employeeNumber: 'ASC' },
        });
    }

    /**
     * 직원번호 패턴으로 직원을 조회합니다
     * @param pattern 직원번호 패턴 (예: "25" - 2025년도 직원들)
     */
    async findByEmployeeNumberPattern(pattern: string): Promise<Employee[]> {
        return await this.employeeRepository.findAll({
            where: {
                employeeNumber: Like(`${pattern}%`),
            },
            order: { employeeNumber: 'ASC' },
        });
    }

    /**
     * 직급 ID로 직원들 조회
     */
    async findByRankId(rankId: string): Promise<Employee[]> {
        return this.employeeRepository.findAll({
            where: { currentRankId: rankId },
            order: { employeeNumber: 'ASC' },
        });
    }

    async saveEmployee(data: any): Promise<Employee> {
        return this.save({
            ...data,
            password: this.hashPassword(data.employeeNumber),
            isInitialPasswordSet: true,
        });
    }

    /**
     * 직원 생성
     */
    async createEmployee(data: {
        employeeNumber: string;
        name: string;
        email?: string;
        phoneNumber?: string;
        dateOfBirth?: Date;
        gender?: any;
        hireDate: Date;
        status: EmployeeStatus;
        currentRankId?: string;
    }): Promise<Employee> {
        return this.save({
            ...data,
            password: this.hashPassword(data.employeeNumber),
            isInitialPasswordSet: true,
        });
    }

    /**
     * 직원 정보 수정
     */
    async updateEmployee(employeeId: string, data: Partial<Employee>): Promise<Employee> {
        return this.update(employeeId, data);
    }

    /**
     * 직원 삭제
     */
    async deleteEmployee(employeeId: string): Promise<void> {
        return this.delete(employeeId);
    }

    /**
     * 현재 연도의 다음 직원번호를 자동 생성
     * 기존 findByEmployeeNumberPattern을 활용하되 최적화
     */
    async generateNextEmployeeNumber(): Promise<string> {
        const currentYear = new Date().getFullYear();
        const yearSuffix = currentYear.toString().slice(-2);

        // 해당 연도의 직원들을 조회
        const employees = await this.findByEmployeeNumberPattern(yearSuffix);

        // prefix로 시작하는 5자리 사번들 중에서 가장 큰 sequence 찾기
        const sequences = employees
            .map((employee) => employee.employeeNumber)
            .filter((employeeNumber) => employeeNumber.length === 5 && employeeNumber.startsWith(yearSuffix))
            .map((employeeNumber) => parseInt(employeeNumber.slice(2)))
            .filter((sequence) => !isNaN(sequence));

        const maxSequence = sequences.length > 0 ? Math.max(...sequences) : 0;
        const nextSequence = maxSequence + 1;
        return `${yearSuffix}${nextSequence.toString().padStart(3, '0')}`;
    }

    /**
     * 이름 중복 시 순번을 붙여서 고유한 이름 생성 (최적화된 버전)
     * @param baseName 기본 이름 (예: "홍길동")
     * @returns 고유한 이름 (예: "홍길동", "홍길동1", "홍길동2", ...)
     */
    async generateUniqueEmployeeName(baseName: string): Promise<string> {
        // 1. 기본 이름이 중복되지 않는지 확인
        const existingEmployee = await this.findByName(baseName);
        if (!existingEmployee) {
            return baseName; // 중복되지 않으면 그대로 반환
        }

        // 2. 중복되는 경우 해당 패턴의 모든 이름을 한 번에 조회
        const patternNames = await this.findNamesByPattern(baseName);

        // 3. 숫자로 끝나는 이름들에서 최대 순번 찾기
        const maxNumber = this.findMaxNumberFromNames(baseName, patternNames);
        const nextNumber = maxNumber + 1;

        return `${baseName}${nextNumber}`;
    }

    /**
     * 이름 패턴으로 직원들 조회 (정확한 패턴 매칭)
     * @param baseName 기본 이름
     * @returns 해당 패턴의 모든 직원 이름 배열
     */
    private async findNamesByPattern(baseName: string): Promise<string[]> {
        try {
            // 1. 정확히 일치하는 이름 조회
            const exactMatch = await this.employeeRepository.findAll({
                where: {
                    name: baseName,
                },
            });

            // 2. baseName으로 시작하는 모든 이름 조회 (광범위하게)
            const allNamesStartingWith = await this.employeeRepository.findAll({
                where: {
                    name: Like(`${baseName}%`),
                },
            });

            // 3. 애플리케이션 레벨에서 정확한 패턴 필터링
            const patternNames = allNamesStartingWith
                .map((emp) => emp.name)
                .filter((name) => this.isExactPatternMatch(baseName, name));

            // 4. 결과 합치기
            const allNames = [...exactMatch.map((emp) => emp.name), ...patternNames];

            return allNames;
        } catch {
            return [];
        }
    }

    /**
     * 정확한 패턴 매칭 확인
     * @param baseName 기본 이름
     * @param name 확인할 이름
     * @returns 패턴에 맞는지 여부
     */
    private isExactPatternMatch(baseName: string, name: string): boolean {
        // 1. 정확히 일치하는 경우
        if (name === baseName) {
            return true;
        }

        // 2. baseName + 숫자 패턴인지 확인
        // 예: "홍길동" -> "홍길동1", "홍길동2", "홍길동10" 등은 true
        //     "홍길동" -> "홍길동기", "홍길동이" 등은 false
        if (name.startsWith(baseName)) {
            const suffix = name.slice(baseName.length);
            // suffix가 숫자로만 구성되어 있는지 확인
            return /^\d+$/.test(suffix);
        }

        return false;
    }

    /**
     * 이름 배열에서 해당 패턴의 최대 숫자 찾기
     * @param baseName 기본 이름
     * @param names 이름 배열
     * @returns 최대 숫자 (없으면 0)
     */
    private findMaxNumberFromNames(baseName: string, names: string[]): number {
        let maxNumber = 0;

        for (const name of names) {
            if (name === baseName) {
                // 정확히 일치하는 경우 (순번 없음)
                maxNumber = Math.max(maxNumber, 0);
            } else if (name.startsWith(baseName)) {
                // baseName으로 시작하는 경우
                const suffix = name.slice(baseName.length);

                // suffix가 숫자로만 구성되어 있는지 확인
                if (/^\d+$/.test(suffix)) {
                    const number = parseInt(suffix);
                    if (!isNaN(number)) {
                        maxNumber = Math.max(maxNumber, number);
                    }
                }
            }
        }

        return maxNumber;
    }

    /**
     * 이름으로 직원 조회
     * @param name 직원 이름
     * @returns 직원 엔티티 또는 null
     */
    async findByName(name: string): Promise<Employee | null> {
        try {
            return await this.employeeRepository.findOne({ where: { name } });
        } catch {
            return null;
        }
    }

    // ==================== 단순한 도메인 함수들 (기존 컨텍스트에서 이동) ====================

    /**
     * 직원 사번 중복 확인
     */
    async isEmployeeNumberDuplicate(employeeNumber: string, excludeId?: string): Promise<boolean> {
        try {
            const employee = await this.findByEmployeeNumber(employeeNumber);
            if (!employee) {
                return false; // 직원이 없으면 중복 아님
            }
            // excludeId가 있고 찾은 직원이 제외할 직원이면 중복 아님
            return excludeId ? employee.id !== excludeId : true;
        } catch {
            return false; // 에러 발생시 중복 아님으로 처리
        }
    }

    /**
     * 직원 이메일 중복 확인 (nullable 처리)
     */
    async isEmailDuplicate(email: string, excludeId?: string): Promise<boolean> {
        if (!email) return false; // nullable 이메일은 중복 체크 안함

        try {
            const employee = await this.findByEmail(email);
            if (!employee) {
                return false; // 직원이 없으면 중복 아님
            }
            // excludeId가 있고 찾은 직원이 제외할 직원이면 중복 아님
            return excludeId ? employee.id !== excludeId : true;
        } catch {
            return false; // 에러 발생시 중복 아님으로 처리
        }
    }

    // ==================== 아키텍처 규칙 적용 메서드 (Setter 활용) ====================

    /**
     * 직원을생성한다
     */
    async 직원을생성한다(
        params: {
            employeeNumber: string;
            name: string;
            email?: string;
            password?: string;
            phoneNumber?: string;
            dateOfBirth?: Date;
            gender?: Gender;
            hireDate: Date;
            currentRankId?: string;
            metadata?: Record<string, any>;
        },
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        const employee = new Employee();

        employee.사번을설정한다(params.employeeNumber);
        employee.이름을설정한다(params.name);

        if (params.email) {
            employee.이메일을설정한다(params.email);
        }

        // 비밀번호는 사번으로 기본 설정
        const hashedPassword = this.hashPassword(params.password || params.employeeNumber);
        employee.비밀번호를설정한다(hashedPassword);
        employee.초기비밀번호를설정완료한다();

        if (params.phoneNumber) {
            employee.전화번호를설정한다(params.phoneNumber);
        }

        if (params.dateOfBirth) {
            employee.생년월일을설정한다(params.dateOfBirth);
        }

        if (params.gender) {
            employee.성별을설정한다(params.gender);
        }

        employee.입사일을설정한다(params.hireDate);
        employee.활성화한다();

        if (params.currentRankId) {
            employee.현재직급을설정한다(params.currentRankId);
        }

        if (params.metadata) {
            employee.메타데이터를설정한다(params.metadata);
        }

        return await this.save(employee, { queryRunner });
    }

    /**
     * 직원을수정한다
     */
    async 직원을수정한다(
        employee: Employee,
        params: {
            name?: string;
            email?: string;
            phoneNumber?: string;
            dateOfBirth?: Date;
            gender?: Gender;
            currentRankId?: string;
            metadata?: Record<string, any>;
        },
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        if (params.name !== undefined) {
            employee.이름을설정한다(params.name);
        }

        if (params.email !== undefined) {
            employee.이메일을설정한다(params.email);
        }

        if (params.phoneNumber !== undefined) {
            employee.전화번호를설정한다(params.phoneNumber);
        }

        if (params.dateOfBirth !== undefined) {
            employee.생년월일을설정한다(params.dateOfBirth);
        }

        if (params.gender !== undefined) {
            employee.성별을설정한다(params.gender);
        }

        if (params.currentRankId !== undefined) {
            employee.현재직급을설정한다(params.currentRankId);
        }

        if (params.metadata !== undefined) {
            employee.메타데이터를설정한다(params.metadata);
        }

        return await this.save(employee, { queryRunner });
    }

    /**
     * 비밀번호를변경한다
     */
    async 비밀번호를변경한다(
        employee: Employee,
        newPassword: string,
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        const hashedPassword = this.hashPassword(newPassword);
        employee.비밀번호를설정한다(hashedPassword);
        employee.초기비밀번호를설정완료한다();
        return await this.save(employee, { queryRunner });
    }

    /**
     * 퇴사처리한다
     */
    async 퇴사처리한다(
        employee: Employee,
        terminationDate: Date,
        terminationReason?: string,
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        employee.퇴사처리한다(terminationDate, terminationReason);
        return await this.save(employee, { queryRunner });
    }

    /**
     * 휴직처리한다
     */
    async 휴직처리한다(employee: Employee, queryRunner?: QueryRunner): Promise<Employee> {
        employee.휴직처리한다();
        return await this.save(employee, { queryRunner });
    }

    /**
     * 복직처리한다
     */
    async 복직처리한다(employee: Employee, queryRunner?: QueryRunner): Promise<Employee> {
        employee.활성화한다();
        return await this.save(employee, { queryRunner });
    }
}
