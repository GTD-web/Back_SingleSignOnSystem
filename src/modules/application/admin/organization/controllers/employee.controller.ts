import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { EmployeeApplicationService } from '../services/employee-application.service';
import {
    CreateEmployeeRequestDto,
    UpdateEmployeeRequestDto,
    AdminEmployeeResponseDto,
    NextEmployeeNumberResponseDto,
    EmployeeDetailListResponseDto,
    BulkUpdateDepartmentRequestDto,
    BulkUpdateTeamRequestDto,
    BulkUpdatePositionRequestDto,
    BulkUpdateRankRequestDto,
    BulkUpdateStatusRequestDto,
    BulkUpdateResultDto,
    PromoteEmployeeRequestDto,
    EmployeeRankHistoryResponseDto,
} from '../dto';
import { EmployeeStatus } from '../../../../../../libs/common/enums';

@ApiTags('Admin - 조직 관리 > 직원')
@Controller('admin/organizations')
export class EmployeeController {
    constructor(private readonly employeeApplicationService: EmployeeApplicationService) {}

    @Get('employees')
    @ApiOperation({
        summary: '직원 상세 목록 조회',
        description:
            '직원 목록을 부서, 직책, 직급, 토큰, FCM토큰, 시스템 역할 정보와 함께 조회합니다. 재직상태로 필터링할 수 있습니다.',
    })
    @ApiQuery({
        name: 'status',
        description: '재직상태 (재직중, 휴직, 퇴사)',
        enum: EmployeeStatus,
        required: false,
    })
    @ApiResponse({ status: 200, type: EmployeeDetailListResponseDto })
    async getEmployees(@Query('status') status?: EmployeeStatus): Promise<EmployeeDetailListResponseDto> {
        return await this.employeeApplicationService.직원상세목록조회(status);
    }

    @Get('employees/next-employee-number')
    @ApiOperation({
        summary: '다음 직원번호 조회',
        description:
            '해당 연도의 다음 순번 직원번호를 조회합니다. 연도를 지정하지 않으면 현재 연도 기준으로 조회합니다.',
    })
    @ApiResponse({
        status: 200,
        type: NextEmployeeNumberResponseDto,
        description: '다음 직원번호 정보 (형식: YY + 순번 3자리, 예: 25001)',
    })
    @ApiQuery({ name: 'year', description: '연도', required: false })
    async getNextEmployeeNumber(@Query('year') year?: number): Promise<NextEmployeeNumberResponseDto> {
        const targetYear = year || new Date().getFullYear();
        return await this.employeeApplicationService.다음직원번호조회(targetYear);
    }

    @Get('employees/:id')
    @ApiOperation({ summary: '직원 상세 조회' })
    @ApiParam({ name: 'id', description: '직원 ID' })
    @ApiResponse({ status: 200, type: AdminEmployeeResponseDto })
    async getEmployee(@Param('id') id: string): Promise<AdminEmployeeResponseDto> {
        return await this.employeeApplicationService.직원상세조회(id);
    }

    @Post('employees')
    @ApiOperation({ summary: '직원 생성' })
    @ApiBody({ type: CreateEmployeeRequestDto })
    @ApiResponse({ status: 201, type: AdminEmployeeResponseDto })
    async createEmployee(@Body() createEmployeeDto: CreateEmployeeRequestDto): Promise<AdminEmployeeResponseDto> {
        return await this.employeeApplicationService.직원생성(createEmployeeDto);
    }

    @Put('employees/:id')
    @ApiOperation({ summary: '직원 수정' })
    @ApiParam({ name: 'id', description: '직원 ID' })
    @ApiBody({ type: UpdateEmployeeRequestDto })
    @ApiResponse({ status: 200, type: AdminEmployeeResponseDto })
    async updateEmployee(
        @Param('id') id: string,
        @Body() updateEmployeeDto: UpdateEmployeeRequestDto,
    ): Promise<AdminEmployeeResponseDto> {
        return await this.employeeApplicationService.직원수정(id, updateEmployeeDto);
    }

    @Delete('employees/:id')
    @ApiOperation({ summary: '직원 삭제' })
    @ApiParam({ name: 'id', description: '직원 ID' })
    @ApiResponse({ status: 200 })
    async deleteEmployee(@Param('id') id: string): Promise<void> {
        return await this.employeeApplicationService.직원삭제(id);
    }

    // ==================== 직원 일괄 수정 ====================

    @Patch('employees/bulk/department')
    @ApiOperation({
        summary: '직원 부서 일괄 수정',
        description: 'DEPARTMENT 타입의 부서에만 일괄 수정 가능합니다.',
    })
    @ApiResponse({ status: 200, description: '부서 일괄 수정 성공', type: BulkUpdateResultDto })
    @ApiResponse({ status: 400, description: '잘못된 요청 (DEPARTMENT 타입이 아님)' })
    @ApiResponse({ status: 404, description: '부서를 찾을 수 없음' })
    async bulkUpdateEmployeeDepartment(@Body() dto: BulkUpdateDepartmentRequestDto): Promise<BulkUpdateResultDto> {
        return await this.employeeApplicationService.직원부서일괄수정(dto.employeeIds, dto.departmentId);
    }

    @Patch('employees/bulk/team')
    @ApiOperation({
        summary: '직원 팀 일괄 배치',
        description: 'TEAM 타입의 부서에만 일괄 배치 가능합니다.',
    })
    @ApiBody({ type: BulkUpdateTeamRequestDto })
    @ApiResponse({ status: 200, description: '팀 일괄 배치 성공', type: BulkUpdateResultDto })
    @ApiResponse({ status: 400, description: '잘못된 요청 (TEAM 타입이 아님)' })
    @ApiResponse({ status: 404, description: '팀을 찾을 수 없음' })
    async bulkUpdateEmployeeTeam(@Body() dto: BulkUpdateTeamRequestDto): Promise<BulkUpdateResultDto> {
        return await this.employeeApplicationService.직원팀일괄배치(dto.employeeIds, dto.teamId);
    }

    @Patch('employees/bulk/position')
    @ApiOperation({ summary: '직원 직책 일괄 수정' })
    @ApiResponse({ status: 200, description: '직책 일괄 수정 성공', type: BulkUpdateResultDto })
    @ApiResponse({ status: 400, description: '잘못된 요청' })
    @ApiResponse({ status: 404, description: '직책을 찾을 수 없음' })
    async bulkUpdateEmployeePosition(@Body() dto: BulkUpdatePositionRequestDto): Promise<BulkUpdateResultDto> {
        return await this.employeeApplicationService.직원직책일괄수정(dto.employeeIds, dto.positionId);
    }

    @Patch('employees/bulk/rank')
    @ApiOperation({ summary: '직원 직급 일괄 수정' })
    @ApiResponse({ status: 200, description: '직급 일괄 수정 성공', type: BulkUpdateResultDto })
    @ApiResponse({ status: 400, description: '잘못된 요청' })
    @ApiResponse({ status: 404, description: '직급을 찾을 수 없음' })
    async bulkUpdateEmployeeRank(@Body() dto: BulkUpdateRankRequestDto): Promise<BulkUpdateResultDto> {
        return await this.employeeApplicationService.직원직급일괄수정(dto.employeeIds, dto.rankId);
    }

    @Patch('employees/bulk/status')
    @ApiOperation({ summary: '직원 재직상태 일괄 수정' })
    @ApiResponse({ status: 200, description: '재직상태 일괄 수정 성공', type: BulkUpdateResultDto })
    @ApiResponse({ status: 400, description: '잘못된 요청' })
    async bulkUpdateEmployeeStatus(@Body() dto: BulkUpdateStatusRequestDto): Promise<BulkUpdateResultDto> {
        const terminationDate = dto.terminationDate ? new Date(dto.terminationDate) : undefined;
        return await this.employeeApplicationService.직원재직상태일괄수정(dto.employeeIds, dto.status, terminationDate);
    }

    // ==================== 직급 이력 관리 ====================

    @Post('employees/:id/rank-promotion')
    @ApiOperation({ summary: '직원 직급 변경' })
    @ApiParam({ name: 'id', description: '직원 ID' })
    @ApiBody({ type: PromoteEmployeeRequestDto })
    @ApiResponse({ status: 201, type: EmployeeRankHistoryResponseDto })
    async promoteEmployee(
        @Param('id') employeeId: string,
        @Body() promoteDto: PromoteEmployeeRequestDto,
    ): Promise<EmployeeRankHistoryResponseDto> {
        return await this.employeeApplicationService.직원직급변경(employeeId, promoteDto);
    }

    @Get('employees/:id/rank-history')
    @ApiOperation({ summary: '직원 직급 이력 조회' })
    @ApiParam({ name: 'id', description: '직원 ID' })
    @ApiResponse({ status: 200, type: [EmployeeRankHistoryResponseDto] })
    async getEmployeeRankHistory(@Param('id') employeeId: string): Promise<EmployeeRankHistoryResponseDto[]> {
        return await this.employeeApplicationService.직원직급이력조회(employeeId);
    }
}

