import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrganizationManagementContextService } from '../../context/organization-management/organization-management-context.service';
import {
    EmployeeRequestDto,
    EmployeeResponseDto,
    EmployeesRequestDto,
    EmployeesResponseDto,
    DepartmentDetailDto,
    PositionDetailDto,
    RankDetailDto,
    DepartmentHierarchyRequestDto,
    DepartmentHierarchyResponseDto,
    DepartmentWithEmployeesDto,
    HireEmployeeRequestDto,
    HireEmployeeResponseDto,
    HiredEmployeeDto,
    TerminateEmployeeRequestDto,
    TerminateEmployeeResponseDto,
    ExportAllDataResponseDto,
    EmployeesManagersResponseDto,
    EmployeeManagersDto,
    EmployeeDepartmentManagersDto,
    DepartmentManagerDto,
    ManagerInfoDto,
} from './dto';
import { Employee, Department, Position, Rank, DepartmentType } from '../../../../libs/database/entities';
import { EmployeeStatus } from '../../../../libs/common/enums';

@Injectable()
export class OrganizationInformationApplicationService {
    constructor(private readonly organizationContextService: OrganizationManagementContextService) {}

    async 직원정보를_조회한다(requestDto: EmployeeRequestDto): Promise<EmployeeResponseDto> {
        const { employeeId, employeeNumber, withDetail } = requestDto;

        // employeeId와 employeeNumber 중 하나는 반드시 있어야 함
        if (!employeeId && !employeeNumber) {
            throw new BadRequestException('직원 ID 또는 사번 중 하나는 반드시 필요합니다.');
        }

        // 직원 조회 (ID 또는 사번)
        const employee = await this.organizationContextService.직원을_조회한다(employeeId || employeeNumber);
        if (!employee) {
            throw new NotFoundException('직원 정보를 찾을 수 없습니다.');
        }
        // 기본 응답 데이터 구성
        let response: EmployeeResponseDto = {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            employeeNumber: employee.employeeNumber,
            phoneNumber: employee.phoneNumber,
            dateOfBirth: employee.dateOfBirth,
            gender: employee.gender,
            hireDate: employee.hireDate,
            status: employee.status,
        };

        // withDetail이 true인 경우 상세 정보 추가
        if (withDetail) {
            const details = await this.organizationContextService.직원의_부서_직책_직급을_조회한다(employee);
            response.department = this.부서_정보를_매핑한다(details.department);
            response.position = this.직책_정보를_매핑한다(details.position);
            response.rank = this.직급_정보를_매핑한다(details.rank);
        }

        return response;
    }

    async 여러_직원정보를_조회한다(requestDto: EmployeesRequestDto): Promise<EmployeesResponseDto> {
        const { identifiers, withDetail = false, includeTerminated = false } = requestDto;

        let employees: Employee[] = [];

        try {
            // 식별자 배열이 제공된 경우
            if (identifiers && identifiers.length > 0) {
                employees = await this.organizationContextService.여러_직원을_조회한다(identifiers, includeTerminated);
            }
            // 식별자가 제공되지 않은 경우 전체 직원 조회
            else {
                employees = await this.organizationContextService.전체_직원정보를_조회한다(includeTerminated);
            }
        } catch (error) {
            throw new NotFoundException('직원 정보를 조회할 수 없습니다.');
        }

        // 각 직원에 대해 상세 정보를 매핑
        const employeeResponses: EmployeeResponseDto[] = [];

        // withDetail이 true인 경우 모든 직원의 상세 정보를 배치로 조회
        let detailsMap: Map<string, { department: Department; position: Position; rank: Rank }> | undefined;
        if (withDetail && employees.length > 0) {
            try {
                detailsMap = await this.organizationContextService.여러_직원의_부서_직책_직급을_일괄조회한다(employees);
            } catch (error) {
                // 상세 정보 조회 실패 시 기본 정보만 반환
            }
        }

        for (const employee of employees) {
            const response: EmployeeResponseDto = {
                id: employee.id,
                name: employee.name,
                email: employee.email,
                employeeNumber: employee.employeeNumber,
                phoneNumber: employee.phoneNumber,
                dateOfBirth: employee.dateOfBirth,
                gender: employee.gender,
                hireDate: employee.hireDate,
                status: employee.status,
            };

            // withDetail이 true이고 상세 정보가 있는 경우 추가
            if (withDetail && detailsMap) {
                const details = detailsMap.get(employee.id);
                if (details) {
                    response.department = this.부서_정보를_매핑한다(details.department);
                    response.position = this.직책_정보를_매핑한다(details.position);
                    response.rank = this.직급_정보를_매핑한다(details.rank);
                }
            }

            employeeResponses.push(response);
        }

        return {
            employees: employeeResponses,
            total: employeeResponses.length,
        };
    }

    private 부서_정보를_매핑한다(department: Department): DepartmentDetailDto | undefined {
        if (!department) return undefined;

        return {
            id: department.id,
            departmentName: department.departmentName,
            departmentCode: department.departmentCode,
            type: department.type,
            parentDepartmentId: department.parentDepartmentId,
            parentDepartmentName: department.parentDepartment?.departmentName,
            order: department.order,
        };
    }

    private 직책_정보를_매핑한다(position: Position): PositionDetailDto | undefined {
        if (!position) return undefined;

        return {
            id: position.id,
            positionTitle: position.positionTitle,
            positionCode: position.positionCode,
            level: position.level,
            hasManagementAuthority: position.hasManagementAuthority,
        };
    }

    private 직급_정보를_매핑한다(rank: Rank): RankDetailDto | undefined {
        if (!rank) return undefined;

        return {
            id: rank.id,
            rankName: rank.rankName,
            rankCode: rank.rankCode,
            level: rank.level,
        };
    }

    async 부서_계층구조별_직원정보를_조회한다(
        requestDto: DepartmentHierarchyRequestDto,
    ): Promise<DepartmentHierarchyResponseDto> {
        const {
            rootDepartmentId,
            maxDepth,
            withEmployeeDetail = false,
            includeTerminated = false,
            includeEmptyDepartments = true,
            includeInactiveDepartments = false,
        } = requestDto;

        try {
            // Context 서비스를 통해 부서 계층구조와 직원 정보 조회
            const result = await this.organizationContextService.부서_계층구조별_직원정보를_조회한다(
                rootDepartmentId,
                maxDepth,
                withEmployeeDetail,
                includeTerminated,
                includeEmptyDepartments,
                includeInactiveDepartments,
            );

            // 응답 DTO로 변환
            const departmentHierarchy = this.부서_계층구조를_응답_DTO로_변환한다(
                result.departments,
                result.employeesByDepartment,
                result.departmentDetails,
                withEmployeeDetail,
            );

            // 통계 계산
            const { totalDepartments, totalEmployees, maxDepthCalculated } =
                this.부서_계층구조_통계를_계산한다(departmentHierarchy);

            return {
                departments: departmentHierarchy.filter((department) => department.parentDepartmentId === null),
                totalDepartments,
                totalEmployees,
                maxDepth: maxDepthCalculated,
            };
        } catch (error) {
            console.error('부서 계층구조 정보 조회 중 오류 발생:', error);
            throw new NotFoundException('부서 계층구조 정보를 조회할 수 없습니다.');
        }
    }

    private 부서_계층구조를_응답_DTO로_변환한다(
        departments: Department[],
        employeesByDepartment: Map<string, { employees: Employee[]; departmentPositions: Map<string, any> }>,
        departmentDetails?: Map<string, { department: Department; position: Position; rank: Rank }[]>,
        withEmployeeDetail = false,
        currentDepth = 0,
    ): DepartmentWithEmployeesDto[] {
        const result: DepartmentWithEmployeesDto[] = [];

        for (const department of departments) {
            if (!department.isActive || department.isException) continue;
            // 해당 부서의 직원 정보 조회
            const departmentEmployeeInfo = employeesByDepartment.get(department.id) || {
                employees: [],
                departmentPositions: new Map(),
            };

            // 직원 정보를 EmployeeResponseDto로 변환
            const employees: EmployeeResponseDto[] = [];
            for (const employee of departmentEmployeeInfo.employees) {
                const employeeResponse: EmployeeResponseDto = {
                    id: employee.id,
                    name: employee.name,
                    email: employee.email,
                    employeeNumber: employee.employeeNumber,
                    phoneNumber: employee.phoneNumber,
                    dateOfBirth: employee.dateOfBirth,
                    gender: employee.gender,
                    hireDate: employee.hireDate,
                    status: employee.status,
                };

                // 🚀 성능 최적화: 상세 정보 매핑 최적화
                if (withEmployeeDetail && departmentDetails) {
                    const deptDetails = departmentDetails.get(department.id);
                    if (deptDetails) {
                        // 해당 직원의 상세 정보 찾기
                        const employeeDetail = deptDetails.find((d) => {
                            // 직원-부서-직책 관계에서 해당 직원 찾기
                            const deptPositions = departmentEmployeeInfo.departmentPositions;
                            return deptPositions.has(employee.id) && d.department.id === department.id;
                        });

                        if (employeeDetail) {
                            employeeResponse.department = this.부서_정보를_매핑한다(employeeDetail.department);
                            employeeResponse.position = this.직책_정보를_매핑한다(employeeDetail.position);
                            employeeResponse.rank = this.직급_정보를_매핑한다(employeeDetail.rank);
                        }
                    }
                }

                employees.push(employeeResponse);
            }

            // 하위 부서 처리
            const childDepartments = this.부서_계층구조를_응답_DTO로_변환한다(
                department.childDepartments || [],
                employeesByDepartment,
                departmentDetails,
                withEmployeeDetail,
                currentDepth + 1,
            );

            const departmentDto: DepartmentWithEmployeesDto = {
                id: department.id,
                departmentName: department.departmentName,
                departmentCode: department.departmentCode,
                type: department.type,
                parentDepartmentId: department.parentDepartmentId,
                parentDepartmentName: department.parentDepartment?.departmentName,
                order: department.order,
                depth: currentDepth,
                employees: employees.sort((a, b) => a.name.localeCompare(b.name)),
                employeeCount: employees.length,
                childDepartments: childDepartments.sort((a, b) => a.order - b.order),
                childDepartmentCount: childDepartments.length,
            };

            result.push(departmentDto);
        }

        return result.sort((a, b) => a.order - b.order);
    }

    private 부서_계층구조_통계를_계산한다(departments: DepartmentWithEmployeesDto[]): {
        totalDepartments: number;
        totalEmployees: number;
        maxDepthCalculated: number;
    } {
        let totalDepartments = 0;
        let totalEmployees = 0;
        let maxDepthCalculated = 0;
        const visitedDepartmentIds = new Set<string>();

        const calculateStats = (depts: DepartmentWithEmployeesDto[]) => {
            for (const dept of depts) {
                // 이미 카운트한 부서는 건너뛰기 (중복 방지)
                if (visitedDepartmentIds.has(dept.id)) {
                    continue;
                }

                visitedDepartmentIds.add(dept.id);
                totalDepartments++;

                // TEAM 타입 부서는 직원 수 집계에서 제외
                if (dept.type !== DepartmentType.TEAM) {
                    totalEmployees += dept.employeeCount;
                }

                maxDepthCalculated = Math.max(maxDepthCalculated, dept.depth);

                if (dept.childDepartments && dept.childDepartments.length > 0) {
                    calculateStats(dept.childDepartments);
                }
            }
        };

        calculateStats(departments);

        return {
            totalDepartments,
            totalEmployees,
            maxDepthCalculated,
        };
    }

    // ==================== 직원 생성 ====================

    /**
     * 직원을 생성한다 (Business Layer - 1단계 Transport 검증)
     * 검증 규칙 1단계: 입력/전송 검증 (DTO validation)
     * 전체 흐름 오케스트레이션
     */
    async 직원을_채용한다(hireEmployeeDto: HireEmployeeRequestDto): Promise<HireEmployeeResponseDto> {
        // 1단계 검증은 이미 DTO validation에서 완료됨 (@IsString, @IsEmail 등)

        try {
            // 날짜 문자열을 Date 객체로 변환
            const hireDate = new Date(hireEmployeeDto.hireDate);
            const dateOfBirth = hireEmployeeDto.dateOfBirth ? new Date(hireEmployeeDto.dateOfBirth) : undefined;
            const lowestPosition = await this.organizationContextService.가장_낮은_직책을_조회한다();
            const positionId = lowestPosition.id;

            // Context Layer 호출 (2-4단계 검증 포함)
            // 이메일은 전처리에서 자동 생성됨
            const result = await this.organizationContextService.직원을_생성한다({
                employeeNumber: hireEmployeeDto.employeeNumber,
                name: hireEmployeeDto.koreanName,
                englishLastName: hireEmployeeDto.englishLastName,
                englishFirstName: hireEmployeeDto.englishFirstName,
                phoneNumber: hireEmployeeDto.phoneNumber,
                dateOfBirth,
                gender: hireEmployeeDto.gender,
                hireDate,
                status: EmployeeStatus.Active,
                currentRankId: hireEmployeeDto.rankId,
                departmentId: hireEmployeeDto.departmentId,
                positionId: positionId,
            });

            // Response DTO로 변환
            return this.직원생성결과를_응답DTO로_변환한다(result);
        } catch (error) {
            // 도메인/컨텍스트 에러들을 적절한 HTTP 에러로 매핑
            this.에러를_HTTP응답으로_매핑한다(error);
        }
    }

    // ==================== 헬퍼 함수들 ====================

    private 직원생성결과를_응답DTO로_변환한다(result: {
        employee: any;
        department?: any;
        rank?: any;
    }): HireEmployeeResponseDto {
        const employee: HiredEmployeeDto = {
            id: result.employee.id,
            employeeNumber: result.employee.employeeNumber,
            name: result.employee.name,
            email: result.employee.email,
            phoneNumber: result.employee.phoneNumber,
            dateOfBirth: result.employee.dateOfBirth?.toISOString().split('T')[0],
            gender: result.employee.gender,
            hireDate: result.employee.hireDate.toISOString().split('T')[0],
            status: result.employee.status,
            currentRankId: result.employee.currentRankId,
            isInitialPasswordSet: result.employee.isInitialPasswordSet,
            createdAt: result.employee.createdAt,
            updatedAt: result.employee.updatedAt,
        };

        const response: HireEmployeeResponseDto = {
            employee,
        };

        if (result.department) {
            response.department = this.부서_정보를_매핑한다(result.department);
        }

        if (result.rank) {
            response.rank = this.직급_정보를_매핑한다(result.rank);
        }

        return response;
    }

    /**
     * 직원 퇴사처리 (수습기간 평가 불합격)
     * 목적: 수습기간 평가 후 불합격 시 직원 상태를 퇴사로 변경
     */
    async 직원을_퇴사처리한다(terminateDto: TerminateEmployeeRequestDto): Promise<TerminateEmployeeResponseDto> {
        try {
            // 날짜 문자열을 Date 객체로 변환
            const terminationDate = new Date(terminateDto.terminationDate);

            // Context Layer 호출
            const result = await this.organizationContextService.직원을_퇴사처리한다({
                employeeIdentifier: terminateDto.employeeIdentifier,
                terminationDate,
                terminationReason: terminateDto.terminationReason,
                processedBy: terminateDto.processedBy,
            });

            // Response DTO로 변환
            return this.퇴사처리결과를_응답DTO로_변환한다(result);
        } catch (error) {
            // 도메인/컨텍스트 에러들을 적절한 HTTP 에러로 매핑
            if (error instanceof Error) {
                throw new BadRequestException(error.message);
            }
            throw new BadRequestException('직원 퇴사처리 중 오류가 발생했습니다.');
        }
    }

    /**
     * 퇴사처리 결과를 응답 DTO로 변환
     */
    private 퇴사처리결과를_응답DTO로_변환한다(result: {
        employee: Employee;
        message: string;
    }): TerminateEmployeeResponseDto {
        return {
            success: true,
            employee: {
                id: result.employee.id,
                employeeNumber: result.employee.employeeNumber,
                name: result.employee.name,
                status: result.employee.status,
                terminationDate: result.employee.terminationDate?.toISOString().split('T')[0] || '',
                terminationReason: result.employee.terminationReason,
                updatedAt: result.employee.updatedAt.toISOString(),
            },
            message: result.message,
        };
    }

    async 전체_조직_데이터를_조회한다(includeInactiveDepartments = false): Promise<ExportAllDataResponseDto> {
        try {
            // 모든 데이터를 병렬로 조회
            const [departments, employees, positions, ranks, employeeDepartmentPositions] = await Promise.all([
                this.organizationContextService.모든_부서를_조회한다(),
                this.organizationContextService.모든_직원을_조회한다(),
                this.organizationContextService.모든_직책을_조회한다(),
                this.organizationContextService.모든_직급을_조회한다(),
                this.organizationContextService.모든_직원부서직책매핑을_조회한다(),
            ]);

            return {
                departments: departments
                    .filter((dept) => {
                        if (dept.isException) return false;
                        return includeInactiveDepartments ? true : dept.isActive;
                    })
                    .map((dept) => ({
                        id: dept.id,
                        departmentName: dept.departmentName,
                        departmentCode: dept.departmentCode,
                        type: dept.type,
                        parentDepartmentId: dept.parentDepartmentId,
                        order: dept.order,
                        createdAt: dept.createdAt,
                        updatedAt: dept.updatedAt,
                    })),
                employees: employees.map((emp) => ({
                    id: emp.id,
                    employeeNumber: emp.employeeNumber,
                    name: emp.name,
                    email: emp.email,
                    password: emp.password,
                    phoneNumber: emp.phoneNumber,
                    dateOfBirth: emp.dateOfBirth,
                    gender: emp.gender,
                    hireDate: emp.hireDate,
                    status: emp.status,
                    currentRankId: emp.currentRankId,
                    terminationDate: emp.terminationDate,
                    terminationReason: emp.terminationReason,
                    isInitialPasswordSet: emp.isInitialPasswordSet,
                    createdAt: emp.createdAt,
                    updatedAt: emp.updatedAt,
                })),
                positions: positions.map((pos) => ({
                    id: pos.id,
                    positionTitle: pos.positionTitle,
                    positionCode: pos.positionCode,
                    level: pos.level,
                    hasManagementAuthority: pos.hasManagementAuthority,
                })),
                ranks: ranks.map((rank) => ({
                    id: rank.id,
                    rankName: rank.rankName,
                    rankCode: rank.rankCode,
                    level: rank.level,
                })),
                employeeDepartmentPositions: employeeDepartmentPositions.map((edp) => ({
                    id: edp.id,
                    employeeId: edp.employeeId,
                    departmentId: edp.departmentId,
                    positionId: edp.positionId,
                    isManager: edp.isManager,
                    createdAt: edp.createdAt,
                    updatedAt: edp.updatedAt,
                })),
                totalCounts: {
                    departments: departments.length,
                    employees: employees.length,
                    positions: positions.length,
                    ranks: ranks.length,
                    employeeDepartmentPositions: employeeDepartmentPositions.length,
                },
                exportedAt: new Date(),
            };
        } catch (error) {
            console.error('전체 조직 데이터 조회 중 오류 발생:', error);
            throw new NotFoundException('조직 데이터를 조회할 수 없습니다.');
        }
    }

    private 에러를_HTTP응답으로_매핑한다(error: any): never {
        // 도메인 에러들을 적절한 HTTP 상태코드로 매핑
        if (error.statusCode) {
            if (error.statusCode === 422) {
                throw new BadRequestException(error.message);
            } else if (error.statusCode === 409) {
                throw new BadRequestException(error.message);
            } else if (error.statusCode === 404) {
                throw new NotFoundException(error.message);
            }
        }

        // 예상하지 못한 에러
        throw new BadRequestException('직원 생성 중 오류가 발생했습니다.');
    }

    // ==================== 직원 관리자 라인 조회 ====================

    /**
     * 전체 직원의 부서 직속 라인 관리자 정보를 조회한다
     * 각 직원의 소속 부서부터 최상위 부서까지 올라가면서 isManager=true인 직원들을 찾는다
     *
     * @param includeTerminated 퇴사한 직원 포함 여부 (기본값: false)
     * @returns 직원별 관리자 라인 정보
     */
    async 전체_직원의_관리자_라인을_조회한다(includeTerminated = false): Promise<EmployeesManagersResponseDto> {
        try {
            // Context Service 호출
            const result = await this.organizationContextService.전체_직원의_관리자_라인을_조회한다(includeTerminated);

            // 응답 DTO로 변환
            const employees: EmployeeManagersDto[] = result.map((item) => ({
                employeeId: item.employeeId,
                name: item.name,
                employeeNumber: item.employeeNumber,
                departments: item.departments.map((dept) => ({
                    departmentId: dept.departmentId,
                    departmentName: dept.departmentName,
                    managerLine: dept.managerLine.map((line) => ({
                        departmentId: line.departmentId,
                        departmentName: line.departmentName,
                        departmentCode: line.departmentCode,
                        type: line.type,
                        parentDepartmentId: line.parentDepartmentId,
                        depth: line.depth,
                        managers: line.managers.map((manager) => ({
                            employeeId: manager.employeeId,
                            name: manager.name,
                            employeeNumber: manager.employeeNumber,
                            email: manager.email,
                            positionId: manager.positionId,
                            positionTitle: manager.positionTitle,
                        })),
                    })),
                })),
            }));

            return {
                employees,
                total: employees.length,
            };
        } catch (error) {
            console.error('전체 직원의 관리자 라인 조회 중 오류 발생:', error);
            throw new NotFoundException('직원의 관리자 라인 정보를 조회할 수 없습니다.');
        }
    }
}
