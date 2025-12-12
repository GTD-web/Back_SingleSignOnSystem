import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { PositionApplicationService } from '../services/position-application.service';
import { CreatePositionRequestDto, UpdatePositionRequestDto, PositionResponseDto } from '../dto';

@ApiTags('Admin - 조직 관리 > 직책')
@Controller('admin/organizations')
export class PositionController {
    constructor(private readonly positionApplicationService: PositionApplicationService) {}

    @Get('positions')
    @ApiOperation({ summary: '직책 목록 조회' })
    @ApiResponse({ status: 200, type: [PositionResponseDto] })
    async getPositions(): Promise<PositionResponseDto[]> {
        return await this.positionApplicationService.직책목록조회();
    }

    @Post('positions')
    @ApiOperation({ summary: '직책 생성' })
    @ApiBody({ type: CreatePositionRequestDto })
    @ApiResponse({ status: 201, type: PositionResponseDto })
    async createPosition(@Body() createPositionDto: CreatePositionRequestDto): Promise<PositionResponseDto> {
        return await this.positionApplicationService.직책생성(createPositionDto);
    }

    @Put('positions/:id')
    @ApiOperation({ summary: '직책 수정' })
    @ApiParam({ name: 'id', description: '직책 ID' })
    @ApiBody({ type: UpdatePositionRequestDto })
    @ApiResponse({ status: 200, type: PositionResponseDto })
    async updatePosition(
        @Param('id') id: string,
        @Body() updatePositionDto: UpdatePositionRequestDto,
    ): Promise<PositionResponseDto> {
        return await this.positionApplicationService.직책수정(id, updatePositionDto);
    }

    @Delete('positions/:id')
    @ApiOperation({ summary: '직책 삭제' })
    @ApiParam({ name: 'id', description: '직책 ID' })
    @ApiResponse({ status: 200 })
    async deletePosition(@Param('id') id: string): Promise<void> {
        return await this.positionApplicationService.직책삭제(id);
    }
}

