import { Controller, Get, Post, Put, Delete, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { User, AuthenticatedUser } from '../../../../../../libs/common/decorators/user.decorator';
import { AssignmentApplicationService } from '../services/assignment-application.service';
import {
    AssignEmployeeRequestDto,
    UpdateEmployeeAssignmentRequestDto,
    UpdateManagerStatusRequestDto,
    EmployeeAssignmentResponseDto,
    EmployeeAssignmentDetailResponseDto,
} from '../dto';

@ApiTags('Admin - 조직 관리 > 배치')
@Controller('admin/organizations')
export class AssignmentController {
    constructor(private readonly assignmentApplicationService: AssignmentApplicationService) {}

    @Get('employee-assignments')
    @ApiOperation({ summary: '전체 직원 배치 목록 조회 (직원/부서/직책/직급 정보 포함)' })
    @ApiResponse({ status: 200, type: [EmployeeAssignmentDetailResponseDto] })
    async getAllEmployeeAssignments(): Promise<EmployeeAssignmentDetailResponseDto[]> {
        return await this.assignmentApplicationService.전체배치목록조회();
    }

    @Get('employees/:id/assignments')
    @ApiOperation({ summary: '직원 배치 현황 조회' })
    @ApiParam({ name: 'id', description: '직원 ID' })
    @ApiResponse({ status: 200, type: [EmployeeAssignmentResponseDto] })
    async getEmployeeAssignments(@Param('id') employeeId: string): Promise<EmployeeAssignmentResponseDto[]> {
        return await this.assignmentApplicationService.직원배치현황조회(employeeId);
    }

    @Post('employee-assignments')
    @ApiOperation({ summary: '직원 부서/직책 배치' })
    @ApiBody({ type: AssignEmployeeRequestDto })
    @ApiResponse({ status: 201, type: EmployeeAssignmentResponseDto })
    async assignEmployee(
        @Body() assignEmployeeDto: AssignEmployeeRequestDto,
        @User() user?: AuthenticatedUser,
    ): Promise<EmployeeAssignmentResponseDto> {
        return await this.assignmentApplicationService.직원배치(assignEmployeeDto, user?.id);
    }

    @Put('employee-assignments/:id')
    @ApiOperation({ summary: '직원 부서/직책 변경' })
    @ApiParam({ name: 'id', description: '배치 ID' })
    @ApiBody({ type: UpdateEmployeeAssignmentRequestDto })
    @ApiResponse({ status: 200, type: EmployeeAssignmentResponseDto })
    async updateEmployeeAssignment(
        @Param('id') id: string,
        @Body() updateAssignmentDto: UpdateEmployeeAssignmentRequestDto,
        @User() user?: AuthenticatedUser,
    ): Promise<EmployeeAssignmentResponseDto> {
        return await this.assignmentApplicationService.직원배치변경(id, updateAssignmentDto, user?.id);
    }

    @Patch('employee-assignments/:id/manager-status')
    @ApiOperation({ summary: '직원 배치 관리자 상태 변경' })
    @ApiParam({ name: 'id', description: '배치 ID' })
    @ApiBody({ type: UpdateManagerStatusRequestDto })
    @ApiResponse({ status: 200, type: EmployeeAssignmentResponseDto, description: '관리자 상태 변경 성공' })
    @ApiResponse({ status: 404, description: '배치 정보를 찾을 수 없음' })
    async updateManagerStatus(
        @Param('id') id: string,
        @Body() updateManagerStatusDto: UpdateManagerStatusRequestDto,
        @User() user?: AuthenticatedUser,
    ): Promise<EmployeeAssignmentResponseDto> {
        return await this.assignmentApplicationService.직원배치_관리자상태변경(id, updateManagerStatusDto, user?.id);
    }

    @Delete('employee-assignments/:id')
    @ApiOperation({ summary: '직원 부서/직책 해제' })
    @ApiParam({ name: 'id', description: '배치 ID' })
    @ApiResponse({ status: 200 })
    async removeEmployeeAssignment(@Param('id') id: string, @User() user?: AuthenticatedUser): Promise<void> {
        return await this.assignmentApplicationService.직원배치해제(id, user?.id);
    }
}
