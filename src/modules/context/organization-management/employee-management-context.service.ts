import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { QueryRunner, DataSource } from 'typeorm';
import { DomainEmployeeService } from '../../domain/employee/employee.service';
import { DomainDepartmentService } from '../../domain/department/department.service';
import { DomainPositionService } from '../../domain/position/position.service';
import { DomainRankService } from '../../domain/rank/rank.service';
import { DomainEmployeeDepartmentPositionService } from '../../domain/employee-department-position/employee-department-position.service';
import { DomainEmployeeRankHistoryService } from '../../domain/employee-rank-history/employee-rank-history.service';
import { DomainEmployeeValidationService } from '../../domain/employee/employee-validation.service';
import { DomainEmployeeTokenService } from '../../domain/employee-token/employee-token.service';
import { DomainEmployeeFcmTokenService } from '../../domain/employee-fcm-token/employee-fcm-token.service';
import { DomainEmployeeSystemRoleService } from '../../domain/employee-system-role/employee-system-role.service';
import {
    Department,
    Employee,
    Position,
    Rank,
    EmployeeDepartmentPosition,
    EmployeeRankHistory,
    EmployeeToken,
    EmployeeFcmToken,
    EmployeeSystemRole,
} from '../../../../libs/database/entities';
import {
    DuplicateEmployeeNumberError,
    DuplicateEmailError,
    RankNotFoundError,
    DepartmentNotFoundError,
    PositionNotFoundError,
} from '../../domain/employee/employee.errors';
import { EmployeeStatus, Gender } from '../../../../libs/common/enums';
import { DepartmentType } from '../../domain/department/department.entity';
import { 직원생성ContextDto } from './dto';
import { RankManagementContextService } from './rank-management-context.service';
import { DomainEmployeeDepartmentPositionHistoryService } from '../../domain/employee-department-position-history/employee-department-position-history.service';

/**
 * 직원 관리 컨텍스트 서비스 (Command)
 * 직원 생성/수정/삭제 및 관련 비즈니스 로직 처리
 */
@Injectable()
export class EmployeeManagementContextService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly 직원서비스: DomainEmployeeService,
        private readonly 부서서비스: DomainDepartmentService,
        private readonly 직책서비스: DomainPositionService,
        private readonly 직급서비스: DomainRankService,
        private readonly 직원부서직책서비스: DomainEmployeeDepartmentPositionService,
        private readonly 배치이력서비스: DomainEmployeeDepartmentPositionHistoryService,
        private readonly 직원직급이력서비스: DomainEmployeeRankHistoryService,
        private readonly 직원검증서비스: DomainEmployeeValidationService,
    ) {}

    async 직원의_기본정보를_생성한다(
        data: {
            employeeNumber: string;
            name: string;
            email: string;
            phoneNumber?: string;
            dateOfBirth?: Date;
            gender?: Gender;
            hireDate: Date;
            currentRankId?: string;
        },
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        const employee = await this.직원서비스.직원을생성한다(
            {
                employeeNumber: data.employeeNumber,
                name: data.name,
                email: data.email,
                phoneNumber: data.phoneNumber,
                dateOfBirth: data.dateOfBirth,
                gender: data.gender,
                hireDate: data.hireDate,
                currentRankId: data.currentRankId,
            },
            queryRunner,
        );

        return employee;
    }

    async 직원의_기본정보를_수정한다(
        employeeId: string,
        data: {
            employeeNumber?: string;
            name?: string;
            email?: string;
            phoneNumber?: string;
            dateOfBirth?: Date;
            gender?: Gender;
            hireDate?: Date;
            currentRankId?: string;
            metadata?: Record<string, any>;
        },
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        const employee = await this.직원을_조회한다(employeeId);
        if (!employee) {
            throw new Error('직원을 찾을 수 없습니다.');
        }

        if (data.currentRankId !== undefined) {
            await this.직원직급이력서비스.createHistory(
                {
                    employeeId,
                    rankId: employee.currentRankId,
                },
                queryRunner,
            );
        }

        const updatedEmployee = await this.직원서비스.직원을수정한다(employee, data, queryRunner);

        return updatedEmployee;
    }

    async 직원의_재직정보를_수정한다(
        employeeId: string,
        data: {
            status?: EmployeeStatus;
            terminationDate?: Date;
            terminationReason?: string;
        },
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        let employee = await this.직원을_조회한다(employeeId);
        if (!employee) {
            throw new Error('직원을 찾을 수 없습니다.');
        }

        switch (data.status) {
            case EmployeeStatus.Terminated:
                employee = await this.직원서비스.퇴사처리한다(
                    employee,
                    data.terminationDate,
                    data.terminationReason,
                    queryRunner,
                );
                break;
            case EmployeeStatus.Active:
                employee = await this.직원서비스.재직처리한다(employee, queryRunner);
                break;
            case EmployeeStatus.Leave:
                employee = await this.직원서비스.휴직처리한다(employee, queryRunner);
                break;
        }

        return employee;
    }

    // ================================================= 리팩토링 구역 =================================================

    // ==================== 직원 조회 ====================

    /**
     * 직원을 조회한다 (통합 함수)
     * ID 또는 사번으로 직원을 조회하고, 존재하지 않으면 에러를 발생시킨다.
     */
    async 직원을_조회한다(identifier: string, throwOnNotFound = true): Promise<Employee | null> {
        try {
            // UUID 형식인지 확인 (직원 ID)
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

            if (isUUID) {
                return await this.직원서비스.findByEmployeeId(identifier);
            } else {
                return await this.직원서비스.findByEmployeeNumber(identifier);
            }
        } catch (error) {
            if (throwOnNotFound) {
                throw new Error(`직원을 찾을 수 없습니다: ${identifier}`);
            }
            return null;
        }
    }

    /**
     * 여러 직원을 조회한다 (통합 함수)
     */
    async 여러_직원을_조회한다(identifiers: string[], includeTerminated = false): Promise<Employee[]> {
        if (identifiers.length === 0) {
            return [];
        }

        // 첫 번째 식별자로 ID인지 사번인지 판단
        const isFirstIdUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifiers[0]);

        if (isFirstIdUUID) {
            return await this.직원서비스.findByEmployeeIds(identifiers, includeTerminated);
        } else {
            return await this.직원서비스.findByEmployeeNumbers(identifiers, includeTerminated);
        }
    }

    /**
     * 전체 직원정보를 조회한다
     */
    async 전체_직원정보를_조회한다(includeTerminated = false): Promise<Employee[]> {
        return this.직원서비스.findAllEmployees(includeTerminated);
    }

    /**
     * 직원의 부서, 직책, 직급을 조회한다
     */
    async 직원의_부서_직책_직급을_조회한다(
        employee: Employee,
    ): Promise<{ department: Department; position: Position; rank: Rank }> {
        const 부서직책정보 = await this.직원부서직책서비스.findByEmployeeId(employee.id);
        const department = 부서직책정보?.departmentId
            ? await this.부서서비스.findById(부서직책정보.departmentId)
            : null;
        const position = 부서직책정보?.positionId ? await this.직책서비스.findById(부서직책정보.positionId) : null;
        const rank = employee.currentRankId ? await this.직급서비스.findById(employee.currentRankId) : null;
        return { department, position, rank };
    }

    /**
     * 여러 직원의 부서, 직책, 직급을 일괄조회한다
     */
    async 여러_직원의_부서_직책_직급을_일괄조회한다(
        employees: Employee[],
    ): Promise<Map<string, { department: Department; position: Position; rank: Rank }>> {
        const employeeIds = employees.map((emp) => emp.id);
        const resultMap = new Map<string, { department: Department; position: Position; rank: Rank }>();

        // 1. 모든 직원의 부서-직책 정보를 한 번에 조회
        const 부서직책정보들 = await this.직원부서직책서비스.findAllByEmployeeIds(employeeIds);

        // 2. 필요한 부서, 직책, 직급 ID들을 수집
        const departmentIds = [...new Set(부서직책정보들.map((info) => info.departmentId))];
        const positionIds = [...new Set(부서직책정보들.map((info) => info.positionId))];
        const rankIds = [...new Set(employees.map((emp) => emp.currentRankId).filter((id) => id))];

        // 3. 부서, 직책, 직급 정보를 배치로 조회
        const [departments, positions, ranks] = await Promise.all([
            this.부서서비스.findByIdsWithParent(departmentIds),
            this.직책서비스.findByIds(positionIds),
            this.직급서비스.findByIds(rankIds),
        ]);

        // 4. 조회된 데이터를 Map으로 변환 (빠른 조회를 위해)
        const departmentMap = new Map(
            departments.filter((dept) => dept.type === DepartmentType.DEPARTMENT).map((dept) => [dept.id, dept]),
        );
        const positionMap = new Map(positions.map((pos) => [pos.id, pos]));
        const rankMap = new Map(ranks.map((rank) => [rank.id, rank]));
        const 부서직책Map = new Map(부서직책정보들.map((info) => [info.employeeId, info]));

        // 5. 각 직원에 대해 정보를 매핑
        for (const employee of employees) {
            const 부서직책정보 = 부서직책Map.get(employee.id);
            if (부서직책정보) {
                const department = departmentMap.get(부서직책정보.departmentId);
                const position = positionMap.get(부서직책정보.positionId);
                const rank = rankMap.get(employee.currentRankId);

                resultMap.set(employee.id, {
                    department,
                    position,
                    rank,
                });
            }
        }

        return resultMap;
    }

    // ==================== 직원 생성 ====================

    /**
     * 직원 번호 생성
     */
    async 연도별_다음직원번호를_조회한다(year: number): Promise<{
        nextEmployeeNumber: string;
        year: number;
        currentCount: number;
    }> {
        const yearSuffix = year.toString().slice(-2); // 연도의 마지막 두 자리

        // 해당 연도의 직원들을 조회
        const employees = await this.직원서비스.findByEmployeeNumberPattern(yearSuffix);

        // prefix로 시작하는 5자리 사번들 중에서 가장 큰 sequence 찾기
        const sequences = employees
            .map((employee) => employee.employeeNumber)
            .filter((employeeNumber) => employeeNumber.length === 5 && employeeNumber.startsWith(yearSuffix))
            .map((employeeNumber) => parseInt(employeeNumber.slice(2)))
            .filter((sequence) => !isNaN(sequence));

        const maxSequence = sequences.length > 0 ? Math.max(...sequences) : 0;
        const nextSequence = maxSequence + 1;
        const nextEmployeeNumber = `${yearSuffix}${nextSequence.toString().padStart(3, '0')}`;

        return {
            nextEmployeeNumber,
            year,
            currentCount: sequences.length,
        };
    }

    /**
     * 직원생성 전처리 (사번/이름/이메일 자동 생성)
     */
    async 직원생성_전처리를_수행한다(
        name: string,
        englishLastName?: string,
        englishFirstName?: string,
    ): Promise<{
        employeeNumber: string;
        name: string;
        email?: string;
    }> {
        const employeeNumber = await this.직원서비스.generateNextEmployeeNumber();
        const uniqueName = await this.직원서비스.generateUniqueEmployeeName(name);

        let email: string | undefined;
        if (englishLastName && englishFirstName) {
            email = await this.고유한_이메일을_생성한다(englishLastName, englishFirstName);
        }

        return {
            employeeNumber,
            name: uniqueName,
            email,
        };
    }

    /**
     * 고유한 이메일 주소 생성 (중복 검사 포함)
     */
    async 고유한_이메일을_생성한다(englishLastName: string, englishFirstName: string): Promise<string> {
        const baseEmail = `${englishLastName}.${englishFirstName}@lumir.space`;

        // 기본 이메일이 중복되지 않으면 반환
        const isDuplicate = await this.직원서비스.isEmailDuplicate(baseEmail);
        if (!isDuplicate) {
            return baseEmail;
        }

        // 중복이면 숫자를 붙여서 시도
        let counter = 1;
        let email = `${englishLastName}.${englishFirstName}${counter}@lumir.space`;

        while (await this.직원서비스.isEmailDuplicate(email)) {
            counter++;
            email = `${englishLastName}.${englishFirstName}${counter}@lumir.space`;
        }

        return email;
    }

    /**
     * 직원생성 컨텍스트 검증
     */
    async 직원생성_컨텍스트_검증을_수행한다(data: {
        employeeNumber: string;
        email?: string;
        currentRankId?: string;
        departmentId?: string;
        positionId?: string;
    }): Promise<void> {
        // 1단계: 도메인 불변식 및 정책 검증 (2-3단계)
        this.직원검증서비스.validateEmployeeCreation({
            employeeNumber: data.employeeNumber,
            email: data.email,
        });

        // 병렬로 모든 검증을 수행 (성능 최적화)
        const [isDuplicateEmployeeNumber, isDuplicateEmail, rankExists, departmentExists, positionExists] =
            await Promise.all([
                this.직원서비스.isEmployeeNumberDuplicate(data.employeeNumber),
                data.email ? this.직원서비스.isEmailDuplicate(data.email) : Promise.resolve(false),
                data.currentRankId ? this.직급서비스.exists(data.currentRankId) : Promise.resolve(true),
                data.departmentId ? this.부서서비스.exists(data.departmentId) : Promise.resolve(true),
                data.positionId ? this.직책서비스.exists(data.positionId) : Promise.resolve(true),
            ]);

        // 검증 결과에 따른 에러 처리
        if (isDuplicateEmployeeNumber) {
            throw new DuplicateEmployeeNumberError(data.employeeNumber);
        }

        if (isDuplicateEmail) {
            throw new DuplicateEmailError(data.email!);
        }

        if (data.currentRankId && !rankExists) {
            throw new RankNotFoundError(data.currentRankId!);
        }

        if (data.departmentId && !departmentExists) {
            throw new DepartmentNotFoundError(data.departmentId!);
        }

        if (data.positionId && !positionExists) {
            throw new PositionNotFoundError(data.positionId!);
        }
    }

    // ==================== 직원 수정/삭제 ====================

    /**
     * 직원을 삭제한다
     */
    async 직원을_삭제한다(employeeId: string, queryRunner?: QueryRunner): Promise<void> {
        // 직원의 모든 배치 정보 삭제
        const assignments = await this.직원부서직책서비스.findAllByEmployeeId(employeeId);
        for (const assignment of assignments) {
            await this.직원부서직책서비스.deleteAssignment(assignment.id, queryRunner);
        }

        // 직원의 모든 배치 이력 삭제
        const assignmentHistories = await this.배치이력서비스.findHistoryByEmployeeId(employeeId);
        for (const history of assignmentHistories) {
            await this.배치이력서비스.delete(history.historyId, { queryRunner });
        }

        // 직원의 모든 직급 이력 삭제
        const rankHistories = await this.직원직급이력서비스.findByEmployeeId(employeeId);
        for (const history of rankHistories) {
            await this.직원직급이력서비스.deleteHistory(history.id, queryRunner);
        }

        // 직원 정보 삭제
        await this.직원서비스.deleteEmployee(employeeId, queryRunner);
    }

    // ==================== 직급 변경 ====================

    /**
     * 직원의 직급을 변경한다
     */
    async 직원의_직급을_변경한다(
        employeeId: string,
        newRankId: string,
        queryRunner?: QueryRunner,
    ): Promise<{
        employee: Employee;
        rankHistory: EmployeeRankHistory;
    }> {
        const updatedEmployee = await this.직원서비스.updateEmployee(employeeId, {
            currentRankId: newRankId,
        });

        const rankHistory = await this.직원직급이력서비스.createHistory({
            employeeId,
            rankId: newRankId,
        });

        return {
            employee: updatedEmployee,
            rankHistory,
        };
    }

    // ==================== 직급 이력 ====================

    /**
     * 직원의 직급이력을 조회한다
     */
    async 직원의_직급이력을_조회한다(employeeId: string): Promise<EmployeeRankHistory[]> {
        return this.직원직급이력서비스.findByEmployeeId(employeeId);
    }

    /**
     * 직급이력을 삭제한다
     */
    async 직급이력을_삭제한다(historyId: string): Promise<void> {
        await this.직원직급이력서비스.deleteHistory(historyId);
    }

    // ==================== 직원 재직상태/퇴사 처리 ====================

    /**
     * 직원 재직상태를 변경한다
     */
    async 직원재직상태를_변경한다(
        employeeId: string,
        status: EmployeeStatus,
        terminationDate?: Date,
        terminationReason?: string,
        queryRunner?: QueryRunner,
    ): Promise<Employee> {
        // 퇴사상태로 변경하는 경우 퇴사처리 함수 호출
        if (status === EmployeeStatus.Terminated) {
            const result = await this.직원을_퇴사처리한다(
                {
                    employeeIdentifier: employeeId,
                    terminationDate: terminationDate || new Date(),
                    terminationReason,
                },
                queryRunner,
            );
            return result.employee;
        }

        // 퇴사가 아닌 다른 상태로 변경하는 경우
        const executeLogic = async (manager: any) => {
            // 1. 직원 존재 확인
            const employee = await manager.findOne(Employee, {
                where: { id: employeeId },
            });

            if (!employee) {
                throw new NotFoundException('직원을 찾을 수 없습니다.');
            }

            // 2. 메타데이터에서 이전 부서, 직책, 관리자 여부 정보 확인 및 원복
            const metadata = employee.metadata || {};
            const previousDepartment = metadata?.termination?.previousDepartment;
            const previousPosition = metadata?.termination?.previousPosition;
            const previousIsManager = metadata?.termination?.previousIsManager ?? false;

            if (previousDepartment && previousDepartment.id) {
                // 이전 부서로 배치 원복
                const currentAssignments = await this.직원부서직책서비스.findAllByEmployeeId(employeeId);
                let departmentAssignment: EmployeeDepartmentPosition | null = null;

                // 현재 DEPARTMENT 타입 배치 찾기
                for (const assignment of currentAssignments) {
                    const department = await this.부서서비스.findById(assignment.departmentId);
                    if (department.type === DepartmentType.DEPARTMENT) {
                        departmentAssignment = assignment;
                        break;
                    }
                }

                // 이전 부서 존재 확인
                const previousDept = await this.부서서비스.findById(previousDepartment.id);
                if (!previousDept) {
                    throw new NotFoundException('이전 부서를 찾을 수 없습니다.');
                }

                // 이전 직책 확인 (없으면 기본 직책 사용)
                let positionToUse: Position | null = null;
                if (previousPosition && previousPosition.id) {
                    positionToUse = await this.직책서비스.findById(previousPosition.id);
                }

                if (!positionToUse) {
                    // 이전 직책이 없거나 찾을 수 없는 경우 기본 직책 조회
                    const defaultPosition = await this.직책서비스.findAll();
                    const firstPosition = defaultPosition.length > 0 ? defaultPosition[0] : null;

                    if (!firstPosition) {
                        throw new NotFoundException('기본 직책을 찾을 수 없습니다.');
                    }
                    positionToUse = firstPosition;
                }

                if (departmentAssignment) {
                    // 기존 DEPARTMENT 타입 배치 업데이트 (부서, 직책, 관리자 여부 모두 원복)
                    await manager.update(
                        EmployeeDepartmentPosition,
                        { id: departmentAssignment.id },
                        {
                            departmentId: previousDepartment.id,
                            positionId: positionToUse.id,
                            isManager: previousIsManager,
                        },
                    );
                } else {
                    // 새로운 배치 생성 (부서, 직책, 관리자 여부 모두 원복)
                    await manager.save(EmployeeDepartmentPosition, {
                        employeeId,
                        departmentId: previousDepartment.id,
                        positionId: positionToUse.id,
                        isManager: previousIsManager,
                    });
                }

                // 메타데이터에서 termination 정보 제거
                const updatedMetadata = { ...metadata };
                delete updatedMetadata.termination;

                // 상태 변경 및 퇴사 관련 필드 초기화, 메타데이터 업데이트
                const updateData: Partial<Employee> = {
                    status,
                    terminationDate: null,
                    terminationReason: null,
                    metadata: Object.keys(updatedMetadata).length > 0 ? updatedMetadata : null,
                };

                await manager.update(Employee, { id: employeeId }, updateData);
            } else {
                // 메타데이터에 이전 부서 정보가 없는 경우
                const updateData: Partial<Employee> = {
                    status,
                    terminationDate: null,
                    terminationReason: null,
                };

                await manager.update(Employee, { id: employeeId }, updateData);
            }

            // 3. 업데이트된 직원 정보 반환
            const updatedEmployee = await manager.findOne(Employee, {
                where: { id: employeeId },
            });

            if (!updatedEmployee) {
                throw new NotFoundException('업데이트된 직원 정보를 찾을 수 없습니다.');
            }

            return updatedEmployee;
        };

        // queryRunner가 제공되면 사용, 아니면 내부 트랜잭션 생성
        if (queryRunner) {
            return await executeLogic(queryRunner.manager);
        } else {
            // DataSource를 사용하여 내부 트랜잭션 생성
            return await this.dataSource.transaction(executeLogic);
        }
    }

    /**
     * 직원을 퇴사처리한다
     */
    async 직원을_퇴사처리한다(
        data: {
            employeeIdentifier: string;
            terminationDate: Date;
            terminationReason?: string;
            processedBy?: string;
        },
        queryRunner?: QueryRunner,
    ): Promise<{
        employee: Employee;
        message: string;
    }> {
        const executeLogic = async (manager: any) => {
            // 1. 직원 조회
            const employee = await this.직원을_조회한다(data.employeeIdentifier);

            // 2. 퇴사처리 검증
            this.퇴사처리_검증을_수행한다(employee, data.terminationDate);

            const employeeId = employee.id;

            // 3-1. 퇴사자 부서 검색
            const terminatedDepartment = await this.부서서비스.findByCode('퇴사자');
            if (!terminatedDepartment) {
                throw new NotFoundException('퇴사자 부서를 찾을 수 없습니다.');
            }

            // 3-2. 현재 부서 정보 조회 (DEPARTMENT 타입만)
            const currentAssignments = await this.직원부서직책서비스.findAllByEmployeeId(employeeId);
            let currentDepartment: Department | null = null;
            let currentPosition: Position | null = null;
            let currentIsManager: boolean = false;
            let departmentAssignment: EmployeeDepartmentPosition | null = null;

            for (const assignment of currentAssignments) {
                const department = await this.부서서비스.findById(assignment.departmentId);
                if (department.type === DepartmentType.DEPARTMENT) {
                    currentDepartment = department;
                    departmentAssignment = assignment;
                    currentPosition = await this.직책서비스.findById(assignment.positionId);
                    currentIsManager = assignment.isManager;
                    break;
                }
            }

            // 3-3. 메타데이터에 부서, 직책, 관리자 여부 정보 저장
            const metadata: Record<string, any> = {
                termination: {
                    previousDepartment: currentDepartment
                        ? {
                              id: currentDepartment.id,
                              name: currentDepartment.departmentName,
                              code: currentDepartment.departmentCode,
                          }
                        : null,
                    previousPosition: currentPosition
                        ? {
                              id: currentPosition.id,
                              title: currentPosition.positionTitle,
                              code: currentPosition.positionCode,
                          }
                        : null,
                    previousIsManager: currentIsManager,
                },
            };

            // 3-4. 직원 정보 업데이트
            await manager.update(
                Employee,
                { id: employeeId },
                {
                    status: EmployeeStatus.Terminated,
                    terminationDate: data.terminationDate,
                    terminationReason: data.terminationReason,
                    metadata,
                },
            );

            // 3-5. 퇴사자 부서로 배치
            if (!currentPosition) {
                const defaultPosition = await this.직책서비스.findAll();
                const firstPosition = defaultPosition.length > 0 ? defaultPosition[0] : null;

                if (!firstPosition) {
                    throw new NotFoundException('기본 직책을 찾을 수 없습니다.');
                }
                currentPosition = firstPosition;
            }

            if (departmentAssignment) {
                await manager.update(
                    EmployeeDepartmentPosition,
                    { id: departmentAssignment.id },
                    {
                        departmentId: terminatedDepartment.id,
                        positionId: currentPosition.id,
                        isManager: false,
                    },
                );
            } else {
                await manager.save(EmployeeDepartmentPosition, {
                    employeeId,
                    departmentId: terminatedDepartment.id,
                    positionId: currentPosition.id,
                    isManager: false,
                });
            }

            // 3-6. token, fcmToken, systemRole 삭제
            await manager.delete(EmployeeToken, { employeeId });
            await manager.delete(EmployeeFcmToken, { employeeId });
            await manager.delete(EmployeeSystemRole, { employeeId });

            // 4. 업데이트된 직원 정보 반환
            const updatedEmployee = await manager.findOne(Employee, {
                where: { id: employeeId },
            });

            if (!updatedEmployee) {
                throw new NotFoundException('업데이트된 직원 정보를 찾을 수 없습니다.');
            }

            return {
                employee: updatedEmployee,
                message: `${employee.name}(${employee.employeeNumber}) 직원이 성공적으로 퇴사처리되었습니다.`,
            };
        };

        if (queryRunner) {
            return await executeLogic(queryRunner.manager);
        } else {
            return await this.dataSource.transaction(executeLogic);
        }
    }

    private 퇴사처리_검증을_수행한다(employee: Employee, terminationDate: Date): void {
        if (terminationDate <= employee.hireDate) {
            throw new Error(
                `퇴사일은 입사일보다 늦어야 합니다. 입사일: ${employee.hireDate.toISOString().split('T')[0]}`,
            );
        }
    }

    // ==================== 직원 일괄 수정 ====================
}
