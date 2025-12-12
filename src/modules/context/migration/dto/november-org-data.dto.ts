import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * 11월 조직도 데이터 DTO
 */
export class November2025OrgDataDto {
    @ApiProperty({ description: '직원 ID (UUID)' })
    @IsUUID()
    employeeId: string;

    @ApiProperty({ description: '직원 이름' })
    @IsString()
    employeeName: string;

    @ApiProperty({ description: '부서명' })
    @IsString()
    departmentName: string;

    @ApiProperty({ description: '부서 ID (UUID)' })
    @IsUUID()
    departmentId: string;

    @ApiProperty({ description: '직책 ID (UUID)' })
    @IsUUID()
    positionId: string;

    @ApiProperty({ description: '직급 ID (UUID)', required: false })
    @IsOptional()
    @IsUUID()
    rankId?: string;

    @ApiProperty({ description: '관리자 여부' })
    @IsBoolean()
    isManager: boolean;
}

/**
 * 11월 조직도 배치 등록 요청 DTO
 */
export class RegisterNovember2025OrgDto {
    @ApiProperty({ description: '11월 조직도 데이터 배열', type: [November2025OrgDataDto] })
    data: November2025OrgDataDto[];
}
