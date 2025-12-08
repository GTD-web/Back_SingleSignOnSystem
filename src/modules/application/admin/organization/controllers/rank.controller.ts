import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { RankApplicationService } from '../services/rank-application.service';
import { CreateRankRequestDto, UpdateRankRequestDto, RankResponseDto } from '../dto';

@ApiTags('Admin - 조직 관리 > 직급')
@Controller('admin/organizations')
export class RankController {
    constructor(private readonly rankApplicationService: RankApplicationService) {}

    @Get('ranks')
    @ApiOperation({ summary: '직급 목록 조회' })
    @ApiResponse({ status: 200, type: [RankResponseDto] })
    async getRanks(): Promise<RankResponseDto[]> {
        return await this.rankApplicationService.직급목록조회();
    }

    @Post('ranks')
    @ApiOperation({ summary: '직급 생성' })
    @ApiBody({ type: CreateRankRequestDto })
    @ApiResponse({ status: 201, type: RankResponseDto })
    async createRank(@Body() createRankDto: CreateRankRequestDto): Promise<RankResponseDto> {
        return await this.rankApplicationService.직급생성(createRankDto);
    }

    @Put('ranks/:id')
    @ApiOperation({ summary: '직급 수정' })
    @ApiParam({ name: 'id', description: '직급 ID' })
    @ApiBody({ type: UpdateRankRequestDto })
    @ApiResponse({ status: 200, type: RankResponseDto })
    async updateRank(@Param('id') id: string, @Body() updateRankDto: UpdateRankRequestDto): Promise<RankResponseDto> {
        return await this.rankApplicationService.직급수정(id, updateRankDto);
    }

    @Delete('ranks/:id')
    @ApiOperation({ summary: '직급 삭제' })
    @ApiParam({ name: 'id', description: '직급 ID' })
    @ApiResponse({ status: 200 })
    async deleteRank(@Param('id') id: string): Promise<void> {
        return await this.rankApplicationService.직급삭제(id);
    }
}

