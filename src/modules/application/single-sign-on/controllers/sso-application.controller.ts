import {
    Controller,
    Post,
    Get,
    Body,
    HttpCode,
    Headers,
    BadRequestException,
    HttpStatus,
    UnauthorizedException,
    Req,
} from '@nestjs/common';
import {
    ApiTags,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
    ApiHeader,
    ApiOperation,
    ApiBasicAuth,
    ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SsoApplicationService } from '../sso-application.service';
import {
    LoginRequestDto,
    LoginResponseDto,
    TokenVerifyResponseDto,
    ChangePasswordRequestDto,
    ChangePasswordResponseDto,
    CheckPasswordRequestDto,
    CheckPasswordResponseDto,
    SystemAuthResponseDto,
    ResetPasswordRequestDto,
    ResetPasswordResponseDto,
} from '../dto';

@ApiTags('Client - 인증 API')
@Controller('auth')
export class SsoApplicationController {
    constructor(private readonly ssoApplicationService: SsoApplicationService) {}

    @Post('system')
    @HttpCode(HttpStatus.OK)
    @ApiBasicAuth()
    @ApiOperation({
        summary: '시스템 인증',
        description: 'SDK가 Basic Auth로 시스템을 인증하고 액세스 토큰을 발급받습니다.',
    })
    @ApiHeader({
        name: 'Authorization',
        description: 'Basic Auth 헤더, 형식: Basic base64(clientId:clientSecret)',
        required: true,
    })
    @ApiResponse({
        status: 200,
        description: '시스템 인증 성공',
        type: SystemAuthResponseDto,
    })
    @ApiResponse({ status: 401, description: '인증 실패' })
    async authenticateSystem(@Headers('authorization') authHeader?: string): Promise<SystemAuthResponseDto> {
        return this.ssoApplicationService.authenticateSystem(authHeader);
    }

    // @ApiBasicAuth()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '로그인 및 토큰 발급',
        description:
            '외부 시스템이 Basic Auth로 인증한 후, 사용자 이메일/비밀번호를 검증하고 액세스 토큰을 발급합니다.',
    })
    // @ApiHeader({
    //     name: 'basic-auth',
    //     description: 'Basic Auth 헤더, 형식: Basic base64(clientId:clientSecret)',
    //     required: false,
    // })
    @ApiBody({ type: LoginRequestDto })
    @ApiResponse({
        status: 200,
        description: '로그인 성공 및 토큰 발급 성공',
        type: LoginResponseDto,
    })
    @ApiResponse({ status: 400, description: '잘못된 요청 형식' })
    @ApiResponse({ status: 401, description: '시스템 인증 실패 또는 사용자 로그인 실패' })
    @ApiResponse({ status: 404, description: '사용자 또는 시스템을 찾을 수 없음' })
    async login(
        @Body() body: LoginRequestDto,
        // @Headers('Authorization') authHeader?: string,
    ): Promise<LoginResponseDto> {
        const result = await this.ssoApplicationService.login(body);
        return result;
    }

    @ApiBearerAuth()
    @Post('verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '토큰 검증' })
    @ApiHeader({
        name: 'Authorization',
        description: 'Bearer 토큰, 형식: Bearer {access_token}',
        required: false,
    })
    @ApiResponse({
        status: 200,
        description: '토큰 검증 성공',
        type: TokenVerifyResponseDto,
    })
    @ApiResponse({ status: 401, description: '유효하지 않은 토큰' })
    async verifyToken(@Headers('Authorization') authHeader: string): Promise<TokenVerifyResponseDto> {
        return this.ssoApplicationService.verifyToken(authHeader);
    }

    @ApiBearerAuth()
    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '비밀번호 변경',
        description: '사용자의 비밀번호를 변경합니다.',
    })
    @ApiHeader({
        name: 'Authorization',
        description: 'Bearer 토큰, 형식: Bearer {access_token}',
        required: true,
    })
    @ApiBody({ type: ChangePasswordRequestDto })
    @ApiResponse({
        status: 200,
        description: '비밀번호 변경 성공',
        type: ChangePasswordResponseDto,
    })
    @ApiResponse({ status: 400, description: '잘못된 요청 형식' })
    @ApiResponse({ status: 401, description: '인증 실패' })
    async changePassword(
        @Headers('Authorization') authHeader: string,
        @Body() body: ChangePasswordRequestDto,
    ): Promise<ChangePasswordResponseDto> {
        return this.ssoApplicationService.changePassword(authHeader, body);
    }

    @ApiBearerAuth()
    @Post('check-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '비밀번호 확인',
        description: '현재 비밀번호가 일치하는지 확인합니다.',
    })
    @ApiHeader({
        name: 'Authorization',
        description: 'Bearer 토큰, 형식: Bearer {access_token}',
        required: true,
    })
    @ApiBody({ type: CheckPasswordRequestDto })
    @ApiResponse({
        status: 200,
        description: '비밀번호 확인 성공',
        type: CheckPasswordResponseDto,
    })
    @ApiResponse({ status: 400, description: '잘못된 요청 형식' })
    @ApiResponse({ status: 401, description: '인증 실패' })
    async checkPassword(
        @Headers('Authorization') authHeader: string,
        @Body() body: CheckPasswordRequestDto,
    ): Promise<CheckPasswordResponseDto> {
        return this.ssoApplicationService.checkPassword(authHeader, body);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '비밀번호 초기화',
        description: '사용자의 비밀번호를 임시 비밀번호로 초기화합니다.',
    })
    @ApiBody({ type: ResetPasswordRequestDto })
    @ApiResponse({
        status: 200,
        description: '비밀번호 초기화 성공',
        type: ResetPasswordResponseDto,
    })
    @ApiResponse({ status: 400, description: '잘못된 요청 형식' })
    @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
    async resetPassword(@Body() body: ResetPasswordRequestDto): Promise<ResetPasswordResponseDto> {
        return this.ssoApplicationService.resetPassword(body);
    }

    @Get('cron/clean-up/token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '만료된 토큰 정리 배치작업',
        description: '만료된 토큰들을 데이터베이스에서 삭제하는 배치작업을 실행합니다.',
    })
    @ApiResponse({
        status: 200,
        description: '배치작업 실행 성공',
        schema: {
            type: 'object',
            properties: {
                deletedCount: {
                    type: 'number',
                    description: '삭제된 토큰 개수',
                },
                message: {
                    type: 'string',
                    description: '실행 결과 메시지',
                },
            },
        },
    })
    @ApiResponse({ status: 500, description: '서버 내부 오류' })
    async cleanUpExpiredTokens(): Promise<{ deletedCount: number; message: string }> {
        return this.ssoApplicationService.만료된_토큰을_정리한다();
    }
}
