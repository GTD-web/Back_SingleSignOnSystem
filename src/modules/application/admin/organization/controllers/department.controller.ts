import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../../../libs/common/guards/jwt-auth.guard';
import { User, AuthenticatedUser } from '../../../../../../libs/common/decorators/user.decorator';
import { DepartmentApplicationService } from '../services/department-application.service';
import {
    CreateDepartmentRequestDto,
    UpdateDepartmentRequestDto,
    DepartmentResponseDto,
    DepartmentListResponseDto,
    UpdateDepartmentOrderRequestDto,
    UpdateDepartmentParentRequestDto,
    UpdateDepartmentActiveStatusRequestDto,
    DepartmentHierarchyResponseDto,
} from '../dto';

@ApiTags('Admin - 조직 관리 > 부서')
// @ApiBearerAuth()
@Controller('admin/organizations')
export class DepartmentController {
    constructor(private readonly departmentApplicationService: DepartmentApplicationService) {}

    @Get('')
    @ApiOperation({
        summary: '부서 계층구조별 직원 정보 조회',
        description: '부서의 계층구조를 따라 각 부서에 속한 직원들의 목록을 깊이와 함께 조회합니다.',
    })
    @ApiResponse({
        status: 200,
        description: '부서 계층구조별 직원 정보 조회 성공',
        type: DepartmentHierarchyResponseDto,
    })
    @ApiResponse({ status: 401, description: '인증이 필요합니다' })
    @ApiResponse({ status: 404, description: '부서 계층구조 정보를 조회할 수 없음' })
    async getDepartmentHierarchy(): Promise<DepartmentHierarchyResponseDto> {
        return this.departmentApplicationService.부서_계층구조별_직원정보를_조회한다();
    }

    @Get('terminated-employees')
    @ApiOperation({
        summary: '퇴사자 부서와 퇴사자 목록 조회',
        description: '퇴사자 부서와 그 아래 배치된 모든 퇴사자들의 목록을 조회합니다.',
    })
    @ApiResponse({
        status: 200,
        description: '퇴사자 부서와 퇴사자 목록 조회 성공',
        type: DepartmentHierarchyResponseDto,
    })
    @ApiResponse({ status: 404, description: '퇴사자 부서를 찾을 수 없음' })
    async getTerminatedEmployees(): Promise<DepartmentHierarchyResponseDto> {
        return this.departmentApplicationService.퇴사자부서_직원목록을_조회한다();
    }

    @Get('departments')
    @ApiOperation({ summary: '부서 목록 조회', description: '전체 부서 목록을 계층구조로 조회합니다.' })
    @ApiResponse({ status: 200, type: DepartmentListResponseDto })
    async getDepartments(): Promise<DepartmentListResponseDto> {
        return await this.departmentApplicationService.부서목록조회();
    }

    @Get('departments/:id')
    @ApiOperation({ summary: '부서 상세 조회' })
    @ApiParam({ name: 'id', description: '부서 ID' })
    @ApiResponse({ status: 200, type: DepartmentResponseDto })
    async getDepartment(@Param('id') id: string): Promise<DepartmentResponseDto> {
        return await this.departmentApplicationService.부서상세조회(id);
    }

    @Post('departments')
    @ApiOperation({ summary: '부서 생성' })
    @ApiBody({ type: CreateDepartmentRequestDto })
    @ApiResponse({ status: 201, type: DepartmentResponseDto })
    async createDepartment(
        @Body() createDepartmentDto: CreateDepartmentRequestDto,
        @User() user?: AuthenticatedUser,
    ): Promise<DepartmentResponseDto> {
        return await this.departmentApplicationService.부서생성(createDepartmentDto, user?.id);
    }

    @Put('departments/:id')
    @ApiOperation({ summary: '부서 수정' })
    @ApiParam({ name: 'id', description: '부서 ID' })
    @ApiBody({ type: UpdateDepartmentRequestDto })
    @ApiResponse({ status: 200, type: DepartmentResponseDto })
    async updateDepartment(
        @Param('id') id: string,
        @Body() updateDepartmentDto: UpdateDepartmentRequestDto,
        @User() user?: AuthenticatedUser,
    ): Promise<DepartmentResponseDto> {
        return await this.departmentApplicationService.부서수정(id, updateDepartmentDto, user?.id);
    }

    @Delete('departments/:id')
    @ApiOperation({ summary: '부서 삭제' })
    @ApiParam({ name: 'id', description: '부서 ID' })
    @ApiResponse({ status: 200 })
    async deleteDepartment(@Param('id') id: string, @User() user?: AuthenticatedUser): Promise<void> {
        return await this.departmentApplicationService.부서삭제(id, user?.id);
    }

    @Patch('departments/:id/order')
    @ApiOperation({ summary: '부서 순서 변경' })
    @ApiParam({ name: 'id', description: '부서 ID' })
    @ApiBody({ type: UpdateDepartmentOrderRequestDto })
    @ApiResponse({ status: 200, type: DepartmentResponseDto })
    async updateDepartmentOrder(
        @Param('id') id: string,
        @Body() updateOrderDto: UpdateDepartmentOrderRequestDto,
        @User() user?: AuthenticatedUser,
    ): Promise<DepartmentResponseDto> {
        return await this.departmentApplicationService.부서순서변경(id, updateOrderDto, user?.id);
    }

    @Patch('departments/:id/parent')
    @ApiOperation({ summary: '부서 상위 부서 변경' })
    @ApiParam({ name: 'id', description: '부서 ID' })
    @ApiBody({ type: UpdateDepartmentParentRequestDto })
    @ApiResponse({ status: 200, type: DepartmentResponseDto })
    async updateDepartmentParent(
        @Param('id') id: string,
        @Body() updateParentDto: UpdateDepartmentParentRequestDto,
        @User() user?: AuthenticatedUser,
    ): Promise<DepartmentResponseDto> {
        return await this.departmentApplicationService.부서상위부서변경(id, updateParentDto, user?.id);
    }

    @Patch('departments/:id/active-status')
    @ApiOperation({ summary: '부서 활성화 상태 변경' })
    @ApiParam({ name: 'id', description: '부서 ID' })
    @ApiBody({ type: UpdateDepartmentActiveStatusRequestDto })
    @ApiResponse({ status: 200, type: DepartmentResponseDto, description: '활성화 상태 변경 성공' })
    @ApiResponse({ status: 404, description: '부서를 찾을 수 없음' })
    async updateDepartmentActiveStatus(
        @Param('id') id: string,
        @Body() updateActiveStatusDto: UpdateDepartmentActiveStatusRequestDto,
        @User() user?: AuthenticatedUser,
    ): Promise<DepartmentResponseDto> {
        return await this.departmentApplicationService.부서활성화상태변경(id, updateActiveStatusDto, user?.id);
    }
}
