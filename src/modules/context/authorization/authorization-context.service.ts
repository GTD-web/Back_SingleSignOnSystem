import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DomainEmployeeService } from '../../domain/employee/employee.service';
import { DomainTokenService } from '../../domain/token/token.service';
import { DomainSystemService } from '../../domain/system/system.service';
import { DomainEmployeeTokenService } from '../../domain/employee-token/employee-token.service';
import { Employee, Token, System } from '../../../../libs/database/entities';

@Injectable()
export class AuthorizationContextService {
    constructor(
        private readonly 직원서비스: DomainEmployeeService,
        private readonly 토큰서비스: DomainTokenService,
        private readonly 시스템서비스: DomainSystemService,
        private readonly 직원토큰서비스: DomainEmployeeTokenService,
    ) {}

    async 시스템을_인증한다(clientId: string, clientSecret: string): Promise<System> {
        // 시스템 조회
        const system = await this.시스템서비스.findByClientId(clientId);

        if (!system) {
            throw new UnauthorizedException('유효하지 않은 클라이언트 ID입니다.');
        }

        // 시스템이 활성화 상태인지 확인
        if (!system.isActive) {
            throw new UnauthorizedException({ message: '비활성화된 시스템입니다.', system: system.name });
        }

        // 클라이언트 시크릿 검증t
        // 시스템의 clientSecret은 이미 해싱된 값
        // bcrypt로 비교 해야함!(await bcrpompare(c,system.))
        const isVerified = await this.시스템서비스.verifyClientSecret(clientSecret, system);
        if (!isVerified) {
            throw new UnauthorizedException('유효하지 않은 클라이언트 시크릿입니다.');
        }

        return system;
    }

    async 로그인정보를_검증한다(email: string, password: string): Promise<Employee> {
        // 사용자 조회
        const employee = await this.직원서비스.findByEmail(email);
        if (!employee) {
            throw new NotFoundException('존재하지 않는 사용자입니다.');
        }

        if (employee.status === '퇴사') {
            throw new UnauthorizedException('퇴사한 사용자입니다.');
        }

        // 패스워드 검증
        const isPasswordValid = await this.직원서비스.verifyPassword(password, employee);
        if (!isPasswordValid) {
            throw new UnauthorizedException('비밀번호가 일치하지 않습니다.');
        }

        return employee;
    }

    async 엑세스토큰을_검증한다(accessToken: string): Promise<{ employee: Employee; token: Token }> {
        // 토큰 검증 및 사용자 정보 추출
        const token = await this.토큰서비스.findByAccessToken(accessToken);

        if (new Date() > token.tokenExpiresAt) {
            throw new UnauthorizedException('만료된 토큰입니다.');
        }
        const payload = this.토큰서비스.verifyJwtToken(accessToken);
        const employee = await this.직원서비스.findOne({
            where: { id: payload.sub },
            relations: [
                'employeeSystemRoles',
                'employeeSystemRoles.systemRole',
                'employeeSystemRoles.systemRole.system',
            ],
        });
        if (!employee) {
            throw new NotFoundException('존재하지 않는 사용자입니다.');
        }

        const roles = payload.roles;

        // 시스템별로 역할을 그룹핑한다.
        const systemRolesMap: Record<string, string[]> = {};
        for (const employeeSystemRole of employee.employeeSystemRoles) {
            if (employeeSystemRole.systemRole && employeeSystemRole.systemRole.system) {
                const systemCode = employeeSystemRole.systemRole.system.name;
                const roleCode = employeeSystemRole.systemRole.roleCode;

                if (!systemRolesMap[systemCode]) {
                    systemRolesMap[systemCode] = [];
                }
                systemRolesMap[systemCode].push(roleCode);
            }
        }

        // 시스템별로 역할 변경사항을 확인한다.
        let hasRoleChanged = false;
        let hasValidRole = false;

        // 1. 모든 시스템 코드를 수집 (DB + 토큰)
        const allSystemCodes = new Set([...Object.keys(systemRolesMap), ...Object.keys(roles)]);

        for (const systemCode of allSystemCodes) {
            const roleCodesFromEmployee = systemRolesMap[systemCode] || [];
            const roleCodesFromToken = roles[systemCode] || [];

            // 역할 배열을 정렬하여 비교
            const sortedEmployeeRoles = [...roleCodesFromEmployee].sort();
            const sortedTokenRoles = [...roleCodesFromToken].sort();

            // 역할이 정확히 일치하는지 확인
            const rolesMatch =
                sortedEmployeeRoles.length === sortedTokenRoles.length &&
                sortedEmployeeRoles.every((role, index) => role === sortedTokenRoles[index]);

            if (!rolesMatch) {
                hasRoleChanged = true;
                console.log(`역할 변경 감지 - 시스템: ${systemCode}`);
                console.log(`  - DB 역할: [${sortedEmployeeRoles.join(', ')}]`);
                console.log(`  - 토큰 역할: [${sortedTokenRoles.join(', ')}]`);
            }

            // 유효한 역할이 하나라도 있는지 확인
            if (roleCodesFromEmployee.length > 0 && roleCodesFromToken.length > 0) {
                const hasMatchingRole = roleCodesFromEmployee.some((role) => roleCodesFromToken.includes(role));
                if (hasMatchingRole) {
                    hasValidRole = true;
                }
            }
        }

        // 역할이 변경되었으면 재로그인 유도
        if (hasRoleChanged) {
            throw new UnauthorizedException({
                message: '권한 정보가 변경되었습니다. 다시 로그인해주세요.',
                code: 'ROLE_CHANGED',
                requiresReLogin: true,
            });
        }

        // 유효한 역할이 하나도 없으면 권한 없음
        if (!hasValidRole) {
            throw new UnauthorizedException('권한이 없습니다.');
        }
        return { employee, token };
    }

    async 리프레시토큰을_검증한다(refresh_token: string): Promise<Employee> {
        // 리프레시 토큰으로 토큰 정보 조회
        const token = await this.토큰서비스.findByRefreshToken(refresh_token);

        if (new Date() > token.refreshTokenExpiresAt) {
            throw new UnauthorizedException('만료된 리프레시 토큰입니다.');
        }
        const payload = this.토큰서비스.verifyJwtToken(refresh_token);
        const employee = await this.직원서비스.findByEmployeeId(payload.sub);
        if (!employee) {
            throw new NotFoundException('존재하지 않는 사용자입니다.');
        }
        return employee;
    }

    async 토큰정보를_생성한다(employee: Employee, roles: Record<string, string[]>): Promise<Token> {
        const expiresInDays = 1;
        const refreshExpiresInDays = 30;

        // JWT 페이로드 생성
        const payload = {
            sub: employee.id,
            employeeNumber: employee.employeeNumber,
            type: 'access',
            roles: roles,
        };

        // 액세스 토큰 생성
        const accessToken = this.토큰서비스.generateJwtToken(payload, '1d');

        // 리프레시 토큰 생성
        const refreshPayload = {
            ...payload,
            type: 'refresh',
        };
        const refreshToken = this.토큰서비스.generateJwtToken(refreshPayload, `${refreshExpiresInDays}d`);

        // 만료일 계산
        const now = new Date();
        const tokenExpiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
        const refreshTokenExpiresAt = new Date(now.getTime() + refreshExpiresInDays * 24 * 60 * 60 * 1000);
        // const existingTokens = await this.직원토큰서비스.findByEmployeeId(employee.id);
        // 사용자의 기존 토큰 확인
        // TODO 추후 논의 후 변경 필요한 부분. 우선 중복세션 허용 - 2025-09-12 김규현
        // if (existingTokens && existingTokens.length > 0) {
        //     const existingToken = existingTokens[0];

        //     return await this.토큰서비스.update(existingToken.tokenId, {
        //         accessToken,
        //         refreshToken,
        //         tokenExpiresAt,
        //         refreshTokenExpiresAt,
        //     });
        // }
        // 기존 토큰이 없으면 새로 생성
        const token = await this.토큰서비스.save({
            accessToken,
            refreshToken,
            tokenExpiresAt,
            refreshTokenExpiresAt,
        });
        await this.직원토큰서비스.save({
            employeeId: employee.id,
            tokenId: token.id,
        });
        return token;
    }

    async 비밀번호를_변경한다(employee: Employee, newPassword: string): Promise<void> {
        await this.직원서비스.비밀번호를변경한다(employee, newPassword);
    }

    async 비밀번호를_검증한다(employee: Employee, password: string): Promise<boolean> {
        return await this.직원서비스.verifyPassword(password, employee);
    }

    async 비밀번호를_초기화한다(employeeNumber: string): Promise<string> {
        const employee = await this.직원서비스.findByEmployeeNumber(employeeNumber);
        if (!employee) {
            throw new NotFoundException('존재하지 않는 사용자입니다.');
        }
        await this.직원서비스.비밀번호를초기화한다(employee);
        return employee.password;
    }

    /**
     * 만료된 토큰들을 정리합니다
     */
    async 만료된_토큰을_정리한다(): Promise<{ deletedCount: number; message: string }> {
        // 1. 먼저 만료된 토큰들을 조회
        const expiredTokens = await this.토큰서비스.findExpiredTokens();

        if (expiredTokens.length === 0) {
            return {
                deletedCount: 0,
                message: '삭제할 만료된 토큰이 없습니다.',
            };
        }

        // 2. 중간테이블(employee-token) 데이터 먼저 삭제
        const tokenIds = expiredTokens.map((token) => token.id);
        await this.직원토큰서비스.deleteByTokenIds(tokenIds);

        // 3. 그 다음 토큰 데이터 삭제
        const result = await this.토큰서비스.deleteExpiredTokens();

        return {
            deletedCount: result.deletedCount,
            message: `만료된 토큰 ${result.deletedCount}개가 성공적으로 삭제되었습니다.`,
        };
    }
}
