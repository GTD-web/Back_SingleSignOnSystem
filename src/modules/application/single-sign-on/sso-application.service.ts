import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthorizationContextService } from '../../context/authorization/authorization-context.service';
import { SystemManagementContextService } from '../../context/system-management/system-management-context.service';
import { OrganizationManagementContextService } from '../../context/organization-management/organization-management-context.service';
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
} from './dto';
import { Employee, Token } from '../../../../libs/database/entities';

@Injectable()
export class SsoApplicationService {
    constructor(
        private readonly authorizationContextService: AuthorizationContextService,
        private readonly systemManagementContextService: SystemManagementContextService,
        private readonly organizationContextService: OrganizationManagementContextService,
    ) {}

    async login(body: LoginRequestDto, authHeader?: string): Promise<LoginResponseDto> {
        // 시스템을 인증한다. - deprecated
        // const result = this.BASIC_헤더_파싱하기(authHeader);
        // if (!result) {
        //     throw new UnauthorizedException('유효하지 않은 인증정보입니다.');
        // }
        // const { clientId, clientSecret } = result;
        // const system = await this.authorizationContextService.시스템을_인증한다(clientId, clientSecret);

        const { grant_type, email, password, refresh_token } = body;

        let employee: Employee;
        switch (grant_type) {
            case 'password':
                employee = await this.authorizationContextService.로그인정보를_검증한다(email, password);
                break;
            case 'refresh_token':
                employee = await this.authorizationContextService.리프레시토큰을_검증한다(refresh_token);
                break;
            default:
                throw new BadRequestException('지원하지 않는 grant_type입니다.');
        }
        // 유저의 관련 정보를 조회한다.
        const { department, position, rank } = await this.organizationContextService.직원의_부서_직책_직급을_조회한다(
            employee,
        );

        // 직원의 모든 시스템 역할 정보를 조회한다.
        const employeeSystemRoles = await this.systemManagementContextService.직원의_시스템역할목록을_조회한다(
            employee.id,
        );

        // 시스템별로 역할을 그룹핑한다.
        const systemRolesMap: Record<string, string[]> = {};
        for (const employeeSystemRole of employeeSystemRoles) {
            if (employeeSystemRole.systemRole && employeeSystemRole.systemRole.system) {
                const systemCode = employeeSystemRole.systemRole.system.name;
                const roleCode = employeeSystemRole.systemRole.roleCode;

                if (!systemRolesMap[systemCode]) {
                    systemRolesMap[systemCode] = [];
                }
                systemRolesMap[systemCode].push(roleCode);
            }
        }

        const token = await this.authorizationContextService.토큰정보를_생성한다(employee, systemRolesMap);
        console.log('token', token);
        return {
            tokenType: 'Bearer',
            accessToken: token.accessToken,
            expiresAt: token.tokenExpiresAt,
            refreshToken: token.refreshToken,
            refreshTokenExpiresAt: token.refreshTokenExpiresAt,
            id: employee.id,
            name: employee.name,
            email: employee.email,
            employeeNumber: employee.employeeNumber,
            phoneNumber: employee.phoneNumber,
            dateOfBirth: employee.dateOfBirth,
            gender: employee.gender,
            hireDate: employee.hireDate,
            status: employee.status,
            department: department?.departmentName || '',
            position: position?.positionTitle || '',
            rank: rank?.rankName || '',
            isInitialPasswordSet: employee.isInitialPasswordSet,
            systemRoles: systemRolesMap,
        };
    }

    async verifyToken(authHeader: string): Promise<TokenVerifyResponseDto> {
        const result = this.BEARER_헤더_파싱하기(authHeader);
        if (!result) {
            throw new UnauthorizedException('유효하지 않은 인증정보입니다.');
        }
        const { accessToken } = result;
        console.log('accessToken', accessToken);
        const { employee, token } = await this.authorizationContextService.엑세스토큰을_검증한다(accessToken);

        return {
            valid: true,
            user_info: {
                id: employee.id,
                name: employee.name,
                email: employee.email,
                employee_number: employee.employeeNumber,
            },
            expires_in: this.만료시간을_초_단위로_계산하기(token.tokenExpiresAt),
        };
    }

    async changePassword(authHeader: string, body: ChangePasswordRequestDto): Promise<ChangePasswordResponseDto> {
        const result = this.BEARER_헤더_파싱하기(authHeader);
        if (!result) {
            throw new UnauthorizedException('유효하지 않은 인증정보입니다.');
        }
        const { accessToken } = result;
        const { employee } = await this.authorizationContextService.엑세스토큰을_검증한다(accessToken);

        const { newPassword } = body;
        await this.authorizationContextService.비밀번호를_변경한다(employee, newPassword);

        return {
            message: '비밀번호가 성공적으로 변경되었습니다.',
        };
    }

    async checkPassword(authHeader: string, body: CheckPasswordRequestDto): Promise<CheckPasswordResponseDto> {
        const result = this.BEARER_헤더_파싱하기(authHeader);
        if (!result) {
            throw new UnauthorizedException('유효하지 않은 인증정보입니다.');
        }
        const { accessToken } = result;
        const { employee } = await this.authorizationContextService.엑세스토큰을_검증한다(accessToken);

        const { currentPassword } = body;
        const isPasswordValid = await this.authorizationContextService.비밀번호를_검증한다(employee, currentPassword);
        return {
            isValid: isPasswordValid,
        };
    }

    async resetPassword(body: ResetPasswordRequestDto): Promise<ResetPasswordResponseDto> {
        const { employeeNumber } = body;
        const temporaryPassword = await this.authorizationContextService.비밀번호를_초기화한다(employeeNumber);

        return {
            message: '비밀번호가 임시 비밀번호로 초기화되었습니다.',
            temporaryPassword,
        };
    }

    async authenticateSystem(authHeader?: string): Promise<SystemAuthResponseDto> {
        // Basic Auth 헤더 파싱
        const result = this.BASIC_헤더_파싱하기(authHeader);
        if (!result) {
            throw new UnauthorizedException('유효하지 않은 인증정보입니다. Basic Auth 헤더가 필요합니다.');
        }

        const { clientId, clientSecret } = result;

        // 시스템 인증
        const system = await this.authorizationContextService.시스템을_인증한다(clientId, clientSecret);

        return {
            systemId: system.id,
            systemName: system.name,
        };
    }

    /**
     * Basic Auth 헤더를 파싱합니다
     */
    BASIC_헤더_파싱하기(authHeader: string): { clientId: string; clientSecret: string } | null {
        try {
            if (!authHeader || !authHeader.startsWith('Basic ')) {
                return null;
            }

            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
            const [clientId, clientSecret] = credentials.split(':');

            if (!clientId || !clientSecret) {
                return null;
            }

            return { clientId, clientSecret };
        } catch (error) {
            console.error('Basic Auth 헤더 파싱 중 오류:', error);
            return null;
        }
    }

    BEARER_헤더_파싱하기(authHeader: string): { accessToken: string } | null {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        const accessToken = authHeader.split(' ')[1];
        return { accessToken };
    }

    만료시간을_초_단위로_계산하기(expiresAt: Date): number {
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        return Math.floor(diffMs / 1000); // 초 단위로 변환
    }

    /**
     * 만료된 토큰들을 정리합니다
     */
    async 만료된_토큰을_정리한다(): Promise<{ deletedCount: number; message: string }> {
        return await this.authorizationContextService.만료된_토큰을_정리한다();
    }
}
