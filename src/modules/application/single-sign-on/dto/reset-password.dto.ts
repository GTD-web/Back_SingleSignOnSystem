import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordRequestDto {
    @ApiProperty({
        description: '비밀번호를 초기화할 사용자의 사번',
        example: '1234567890',
    })
    @IsString()
    employeeNumber: string;
}

export class ResetPasswordResponseDto {
    @ApiProperty({
        example: '비밀번호가 임시 비밀번호로 초기화되었습니다.',
        description: '응답 메시지',
    })
    message: string;

    @ApiProperty({
        example: 'temp1234',
        description: '생성된 임시 비밀번호',
    })
    temporaryPassword: string;
}
