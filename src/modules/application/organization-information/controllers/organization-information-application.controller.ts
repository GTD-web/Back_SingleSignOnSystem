import {
    Controller,
    Get,
    Post,
    Query,
    Body,
    HttpCode,
    HttpStatus,
    BadRequestException,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiQuery, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { OrganizationInformationApplicationService } from '../organization-information-application.service';
import {
    EmployeeRequestDto,
    EmployeeResponseDto,
    EmployeesRequestDto,
    EmployeesResponseDto,
    DepartmentHierarchyRequestDto,
    DepartmentHierarchyResponseDto,
    HireEmployeeRequestDto,
    HireEmployeeResponseDto,
    TerminateEmployeeRequestDto,
    TerminateEmployeeResponseDto,
    ExportAllDataResponseDto,
    EmployeesManagersResponseDto,
} from '../dto';
import { JwtAuthGuard } from '../../../../../libs/common/guards/jwt-auth.guard';
import { User, AuthenticatedUser } from '../../../../../libs/common/decorators/user.decorator';
import { Public } from '../../../../../libs/common/decorators/public.decorator';
import { MigrationService } from '../../../context/migration/migration.service';

@ApiTags('Client - 조직 정보 API')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard)
@Controller('organization')
export class OrganizationInformationApplicationController {
    constructor(
        private readonly organizationInformationApplicationService: OrganizationInformationApplicationService,
    ) {}

    @Get('employee')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '직원 정보 조회',
        description: '직원 ID 또는 사번으로 직원의 기본 정보와 조직 정보를 조회합니다.',
    })
    @ApiQuery({
        name: 'employeeId',
        description: '직원 ID',
        required: false,
        type: String,
        example: 'emp123',
    })
    @ApiQuery({
        name: 'employeeNumber',
        description: '사번',
        required: false,
        type: String,
        example: 'E2023001',
    })
    @ApiQuery({
        name: 'withDetail',
        description: '상세 정보 포함 여부 (부서, 직책, 직급의 상세 정보)',
        required: false,
        type: Boolean,
        example: true,
    })
    @ApiResponse({
        status: 200,
        description: '직원 정보 조회 성공',
        type: EmployeeResponseDto,
    })
    @ApiResponse({ status: 400, description: '잘못된 요청 형식 (직원 ID 또는 사번 중 하나는 필수)' })
    @ApiResponse({ status: 401, description: '인증이 필요합니다' })
    @ApiResponse({ status: 404, description: '해당 직원을 찾을 수 없음' })
    async getEmployee(
        @User() user: AuthenticatedUser,
        @Query('employeeId') employeeId?: string,
        @Query('employeeNumber') employeeNumber?: string,
        @Query('withDetail') withDetail?: boolean,
    ): Promise<EmployeeResponseDto> {
        // 인증된 사용자 정보 로깅 (개발용)
        console.log('인증된 사용자:', user);

        // Query 파라미터를 DTO로 변환
        const requestDto: EmployeeRequestDto = {
            employeeId,
            employeeNumber,
            withDetail,
        };

        return this.organizationInformationApplicationService.직원정보를_조회한다(requestDto);
    }

    @Get('employees')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '여러 직원 정보 조회',
        description:
            '직원 ID 배열 또는 사번 배열로 여러 직원의 정보를 조회합니다. 배열이 비어있으면 전체 직원을 조회합니다.',
    })
    @ApiQuery({
        name: 'identifiers',
        description: '직원 식별자 배열 (직원 ID 또는 사번, 쉼표로 구분)',
        required: false,
        type: String,
        example: 'emp123,E2023001,emp456,E2023002',
    })
    @ApiQuery({
        name: 'withDetail',
        description: '상세 정보 포함 여부 (부서, 직책, 직급의 상세 정보)',
        required: false,
        type: Boolean,
        example: false,
    })
    @ApiQuery({
        name: 'includeTerminated',
        description: '퇴사한 직원 포함 여부',
        required: false,
        type: Boolean,
        example: false,
    })
    @ApiResponse({
        status: 200,
        description: '직원 목록 조회 성공',
        type: EmployeesResponseDto,
    })
    @ApiResponse({ status: 401, description: '인증이 필요합니다' })
    @ApiResponse({ status: 404, description: '직원 정보를 조회할 수 없음' })
    async getEmployees(
        @User() user: AuthenticatedUser,
        @Query('identifiers') identifiers?: string,
        @Query('withDetail') withDetail?: boolean,
        @Query('includeTerminated') includeTerminated?: boolean,
    ): Promise<EmployeesResponseDto> {
        // 쉼표로 구분된 문자열을 배열로 변환
        const identifiersArray = identifiers
            ? identifiers
                  .split(',')
                  .map((id) => id.trim())
                  .filter((id) => id.length > 0)
            : undefined;

        // Query 파라미터를 DTO로 변환
        const requestDto: EmployeesRequestDto = {
            identifiers: identifiersArray,
            withDetail: withDetail || false,
            includeTerminated: includeTerminated || false,
        };

        return this.organizationInformationApplicationService.여러_직원정보를_조회한다(requestDto);
    }

    @Get('departments/hierarchy')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '부서 계층구조별 직원 정보 조회',
        description: '부서의 계층구조를 따라 각 부서에 속한 직원들의 목록을 깊이와 함께 조회합니다.',
    })
    @ApiQuery({
        name: 'rootDepartmentId',
        description: '조회할 최상위 부서 ID (지정하지 않으면 전체 조직도 조회)',
        required: false,
        type: String,
        example: 'dept-uuid-123',
    })
    @ApiQuery({
        name: 'maxDepth',
        description: '최대 조회 깊이 (기본값: 무제한)',
        required: false,
        type: Number,
        example: 3,
    })
    @ApiQuery({
        name: 'withEmployeeDetail',
        description: '직원 상세 정보 포함 여부 (부서, 직책, 직급 정보)',
        required: false,
        type: Boolean,
        example: true,
    })
    @ApiQuery({
        name: 'includeTerminated',
        description: '퇴사한 직원 포함 여부',
        required: false,
        type: Boolean,
        example: false,
    })
    @ApiQuery({
        name: 'includeEmptyDepartments',
        description: '빈 부서 포함 여부 (직원이 없는 부서도 포함)',
        required: false,
        type: Boolean,
        example: true,
    })
    @ApiQuery({
        name: 'includeInactiveDepartments',
        description: '비활성화된 부서 포함 여부',
        required: false,
        type: Boolean,
        example: false,
    })
    @ApiResponse({
        status: 200,
        description: '부서 계층구조별 직원 정보 조회 성공',
        type: DepartmentHierarchyResponseDto,
    })
    @ApiResponse({ status: 401, description: '인증이 필요합니다' })
    @ApiResponse({ status: 404, description: '부서 계층구조 정보를 조회할 수 없음' })
    async getDepartmentHierarchy(
        @User() user: AuthenticatedUser,
        @Query('rootDepartmentId') rootDepartmentId?: string,
        @Query('maxDepth') maxDepth?: number,
        @Query('withEmployeeDetail') withEmployeeDetail?: boolean,
        @Query('includeTerminated') includeTerminated?: boolean,
        @Query('includeEmptyDepartments') includeEmptyDepartments?: boolean,
        @Query('includeInactiveDepartments') includeInactiveDepartments?: boolean,
    ): Promise<DepartmentHierarchyResponseDto> {
        // 인증된 사용자 정보 로깅 (개발용)
        console.log('부서 계층구조 조회 - 인증된 사용자:', user);

        // Query 파라미터를 DTO로 변환
        const requestDto: DepartmentHierarchyRequestDto = {
            rootDepartmentId,
            maxDepth: maxDepth ? Number(maxDepth) : undefined,
            withEmployeeDetail: withEmployeeDetail === true || String(withEmployeeDetail) === 'true',
            includeTerminated: includeTerminated === true || String(includeTerminated) === 'true',
            includeEmptyDepartments: includeEmptyDepartments !== false && String(includeEmptyDepartments) !== 'false',
            includeInactiveDepartments:
                includeInactiveDepartments === true || String(includeInactiveDepartments) === 'true',
        };

        return this.organizationInformationApplicationService.부서_계층구조별_직원정보를_조회한다(requestDto);
    }

    @Post('employee/hire')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: '채용 프로세스 완료 후 - 직원 채용',
        description: '새로운 직원을 생성합니다. 검증 규칙 4단계에 따라 완전한 검증을 수행합니다.',
    })
    @ApiBody({
        type: HireEmployeeRequestDto,
        description: '생성할 직원 정보',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '직원이 성공적으로 생성되었습니다.',
        type: HireEmployeeResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '입력 데이터가 유효하지 않거나 비즈니스 규칙을 위반했습니다.',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: '이미 존재하는 사번입니다: 25001' },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '참조하는 직급, 부서, 직책이 존재하지 않습니다.',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: '존재하지 않는 직급입니다: rank-uuid' },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    async 채용프로세스에_합격한_직원을_생성한다(
        @Body() hireEmployeeDto: HireEmployeeRequestDto,
    ): Promise<HireEmployeeResponseDto> {
        return await this.organizationInformationApplicationService.직원을_채용한다(hireEmployeeDto);
    }

    @Post('employee/terminate')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '수습평가 후 - 직원 퇴사처리',
        description: '수습기간 평가 후 불합격 시 직원을 퇴사처리합니다. 3개월 수습기간이 지난 후에만 가능합니다.',
    })
    @ApiBody({
        type: TerminateEmployeeRequestDto,
        description: '퇴사처리할 직원 정보',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '직원이 성공적으로 퇴사처리되었습니다.',
        type: TerminateEmployeeResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '입력 데이터가 유효하지 않거나 비즈니스 규칙을 위반했습니다.',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: '수습기간(3개월)이 지나지 않았습니다. 최소 퇴사일: 2025-04-01' },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '해당 직원을 찾을 수 없습니다.',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: '직원을 찾을 수 없습니다: 25001' },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '이미 퇴사처리된 직원입니다.',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                message: { type: 'string', example: '이미 퇴사처리된 직원입니다: 홍길동(25001)' },
                error: { type: 'string', example: 'Conflict' },
            },
        },
    })
    async 수습기간_평가_불합격으로_직원을_퇴사처리한다(
        @Body() terminateEmployeeDto: TerminateEmployeeRequestDto,
    ): Promise<TerminateEmployeeResponseDto> {
        return await this.organizationInformationApplicationService.직원을_퇴사처리한다(terminateEmployeeDto);
    }

    @Get('export/all')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '전체 조직 데이터 Export (마이그레이션용)',
        description:
            '5개 테이블(departments, employees, positions, ranks, employee_department_positions)의 전체 데이터를 ID 값을 포함하여 그대로 조회합니다. 마이그레이션 목적으로 사용됩니다.',
    })
    @ApiQuery({
        name: 'includeInactive',
        description: '비활성화된 부서 포함 여부',
        required: false,
        type: Boolean,
        example: false,
    })
    @ApiResponse({
        status: 200,
        description: '전체 조직 데이터 조회 성공',
        type: ExportAllDataResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: '데이터 조회 실패',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: '조직 데이터를 조회할 수 없습니다.' },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    async exportAllOrganizationData(
        @Query('includeInactive') includeInactive?: boolean,
    ): Promise<ExportAllDataResponseDto> {
        console.log('[Export All Data] 전체 조직 데이터 조회 시작');
        const result = await this.organizationInformationApplicationService.전체_조직_데이터를_조회한다(
            includeInactive === true || String(includeInactive) === 'true',
        );
        // console.log('result', result.departments);
        console.log('[Export All Data] 조회 완료:', {
            departments: result.totalCounts.departments,
            employees: result.totalCounts.employees,
            positions: result.totalCounts.positions,
            ranks: result.totalCounts.ranks,
            employeeDepartmentPositions: result.totalCounts.employeeDepartmentPositions,
        });
        return result;
    }

    @Get('employees/managers')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '전체 직원의 부서 직속 라인 관리자 정보 조회',
        description:
            '전체 직원을 조회하여 각 직원의 소속 부서부터 최상위 부서까지 올라가면서 isManager=true인 관리자 정보를 조회합니다.',
    })
    @ApiResponse({
        status: 200,
        description: '직원별 관리자 라인 정보 조회 성공',
        type: EmployeesManagersResponseDto,
    })
    @ApiResponse({ status: 401, description: '인증이 필요합니다' })
    @ApiResponse({ status: 404, description: '관리자 라인 정보를 조회할 수 없음' })
    async getEmployeesManagers(@User() user: AuthenticatedUser): Promise<EmployeesManagersResponseDto> {
        // 인증된 사용자 정보 로깅 (개발용)
        console.log('직원 관리자 라인 조회 - 인증된 사용자:', user);

        const includeTerminatedFlag = false;

        return this.organizationInformationApplicationService.전체_직원의_관리자_라인을_조회한다(includeTerminatedFlag);
    }
}
