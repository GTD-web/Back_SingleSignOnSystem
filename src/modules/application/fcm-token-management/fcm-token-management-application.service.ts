import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FcmTokenManagementContextService } from '../../context/fcm-token-management/fcm-token-management-context.service';
import {
    FcmSubscribeRequestDto,
    FcmSubscribeResponseDto,
    FcmTokenResponseDto,
    FcmTokensResponseDto,
    MultipleFcmTokensResponseDto,
    FlatFcmTokenDto,
    FcmUnsubscribeResponseDto,
    BaseEmployeeIdentifierDto,
    FcmRemoveTokenRequestDto,
    FcmRemoveTokenResponseDto,
    FcmTokenRemoveResultDto,
} from './dto';
// DeviceType enum 제거 - 이제 문자열로 처리
import { Employee } from '../../domain/employee/employee.entity';
import { OrganizationManagementContextService } from '../../context/organization-management/organization-management-context.service';

@Injectable()
export class FcmTokenManagementApplicationService {
    constructor(
        private readonly organizationContextService: OrganizationManagementContextService,
        private readonly fcmTokenManagementContextService: FcmTokenManagementContextService,
    ) {}

    /**
     * DTO로부터 직원 정보를 조회하는 헬퍼 메서드
     */
    private async getEmployeeFromIdentifier(dto: BaseEmployeeIdentifierDto): Promise<Employee> {
        // 입력 검증
        if (!dto.employeeId && !dto.employeeNumber) {
            throw new BadRequestException('employeeId 또는 employeeNumber 중 하나는 반드시 제공되어야 합니다.');
        }

        try {
            // 둘 다 제공된 경우 정합성 체크
            if (dto.employeeId && dto.employeeNumber) {
                return await this.validateAndGetEmployeeWithBothIdentifiers(dto.employeeId, dto.employeeNumber);
            }

            // 직원 조회 (ID 또는 사번)
            return await this.organizationContextService.직원을_조회한다(dto.employeeId || dto.employeeNumber);
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error; // 정합성 체크 에러는 그대로 전파
            }
            throw new NotFoundException('직원 정보를 찾을 수 없습니다.');
        }

        throw new BadRequestException('유효한 직원 식별자가 제공되지 않았습니다.');
    }

    /**
     * employeeId와 employeeNumber가 둘 다 제공된 경우 정합성을 체크합니다
     */
    private async validateAndGetEmployeeWithBothIdentifiers(
        employeeId: string,
        employeeNumber: string,
    ): Promise<Employee> {
        // 병렬로 두 조회를 실행
        const [employeeById, employeeByNumber] = await Promise.all([
            this.organizationContextService.직원을_조회한다(employeeId, false).catch(() => null),
            this.organizationContextService.직원을_조회한다(employeeNumber, false).catch(() => null),
        ]);

        // 둘 중 하나라도 조회되지 않은 경우
        if (!employeeById && !employeeByNumber) {
            throw new NotFoundException('제공된 employeeId와 employeeNumber로 직원 정보를 찾을 수 없습니다.');
        }

        if (!employeeById) {
            throw new NotFoundException(`employeeId '${employeeId}'로 직원 정보를 찾을 수 없습니다.`);
        }

        if (!employeeByNumber) {
            throw new NotFoundException(`employeeNumber '${employeeNumber}'로 직원 정보를 찾을 수 없습니다.`);
        }

        // 정합성 체크: 두 조회 결과가 같은 직원인지 확인
        if (employeeById.id !== employeeByNumber.id) {
            throw new BadRequestException(
                `employeeId '${employeeId}'와 employeeNumber '${employeeNumber}'가 서로 다른 직원을 가리킵니다. ` +
                    `employeeId는 '${employeeById.employeeNumber}' 직원을, ` +
                    `employeeNumber는 '${employeeByNumber.id}' 직원을 가리킵니다.`,
            );
        }

        // 정합성 체크 통과 - employeeId로 조회한 결과 반환
        return employeeById;
    }

    async FCM토큰을_구독한다(requestDto: FcmSubscribeRequestDto): Promise<FcmSubscribeResponseDto> {
        const { fcmToken, deviceType, deviceInfo } = requestDto;

        // 직원 정보 조회 (employeeId 우선, 없으면 employeeNumber)
        const employee = await this.getEmployeeFromIdentifier(requestDto);
        console.log('employee', employee);
        // FCM 토큰 등록
        await this.fcmTokenManagementContextService.FCM토큰을_직원에게_등록한다(
            employee.id,
            fcmToken,
            deviceType,
            deviceInfo,
        );
        console.log('fcmToken', fcmToken);
        console.log('deviceType', deviceType);
        console.log('deviceInfo', deviceInfo);
        return {
            fcmToken: fcmToken,
        };
    }

    async FCM토큰을_조회한다(requestDto: BaseEmployeeIdentifierDto): Promise<FcmTokensResponseDto> {
        // 직원 정보 조회
        const employee = await this.getEmployeeFromIdentifier(requestDto);
        if (!employee) {
            throw new NotFoundException('직원 정보를 찾을 수 없습니다.');
        }
        // 직원의 FCM 토큰 목록 조회
        const employeeFcmTokens = await this.fcmTokenManagementContextService.직원의_활성_FCM토큰_목록을_조회한다(
            employee.id,
        );

        // 토큰 정보 변환
        const tokens = employeeFcmTokens.map((employeeFcmToken) => ({
            fcmToken: employeeFcmToken.fcmToken,
            deviceType: employeeFcmToken.deviceType,
            createdAt: employeeFcmToken.createdAt,
            updatedAt: employeeFcmToken.updatedAt,
        }));

        return {
            employeeId: employee.id,
            employeeNumber: employee.employeeNumber,
            tokens: tokens,
        };
    }

    async FCM토큰_구독을_해지한다(requestDto: BaseEmployeeIdentifierDto): Promise<boolean> {
        // 직원 정보 조회
        const employee = await this.getEmployeeFromIdentifier(requestDto);

        // 직원의 모든 FCM 토큰 제거
        await this.fcmTokenManagementContextService.직원의_모든_FCM토큰을_제거한다(employee.id);

        return true;
    }

    // 알림서버용 API - 여러 직원의 FCM 토큰을 한 번에 조회 (직원번호 기준)
    async 여러_직원의_FCM토큰을_조회한다(employeeNumbers: string[]): Promise<MultipleFcmTokensResponseDto> {
        return this.여러_직원의_FCM토큰을_통합_조회한다(employeeNumbers, 'number');
    }

    // 알림서버용 API - 여러 직원의 FCM 토큰을 한 번에 조회 (직원 ID 기준)
    async 여러_직원의_FCM토큰을_ID로_조회한다(employeeIds: string[]): Promise<MultipleFcmTokensResponseDto> {
        return this.여러_직원의_FCM토큰을_통합_조회한다(employeeIds, 'id');
    }

    // 여러 직원의 FCM 토큰 통합 조회 헬퍼 메서드
    private async 여러_직원의_FCM토큰을_통합_조회한다(
        identifiers: string[],
        type: 'id' | 'number',
    ): Promise<MultipleFcmTokensResponseDto> {
        const byEmployee: FcmTokensResponseDto[] = [];
        const allTokens: FlatFcmTokenDto[] = [];

        for (const identifier of identifiers) {
            try {
                // 직원 정보 조회 (통합 함수 사용)
                const employee = await this.organizationContextService.직원을_조회한다(identifier);
                // 직원의 FCM 토큰 목록 조회
                const employeeFcmTokens =
                    await this.fcmTokenManagementContextService.직원의_활성_FCM토큰_목록을_조회한다(employee.id);
                if (employeeFcmTokens.length > 0) {
                    // 직원별 토큰 정보
                    const tokens = employeeFcmTokens.map((employeeFcmToken) => ({
                        fcmToken: employeeFcmToken.fcmToken,
                        deviceType: employeeFcmToken.deviceType,
                        createdAt: employeeFcmToken.createdAt,
                        updatedAt: employeeFcmToken.updatedAt,
                    }));

                    byEmployee.push({
                        employeeId: employee.id,
                        employeeNumber: employee.employeeNumber,
                        tokens: tokens,
                    });

                    // flat 배열용 토큰 정보
                    const flatTokens = employeeFcmTokens.map((employeeFcmToken) => ({
                        employeeId: employee.id,
                        employeeNumber: employee.employeeNumber,
                        fcmToken: employeeFcmToken.fcmToken,
                        deviceType: employeeFcmToken.deviceType,
                        createdAt: employeeFcmToken.createdAt,
                        updatedAt: employeeFcmToken.updatedAt,
                    }));

                    allTokens.push(...flatTokens);
                }
            } catch (error) {
                // 개별 직원 조회 실패는 무시하고 계속 진행
                console.warn(`${type} ${identifier} 조회 실패:`, error);
            }
        }

        return {
            byEmployee: byEmployee,
            allTokens: allTokens,
            totalEmployees: byEmployee.length,
            totalTokens: allTokens.length,
        };
    }

    async 여러_직원의_여러_토큰을_일괄제거한다(
        requestDto: FcmRemoveTokenRequestDto,
    ): Promise<FcmRemoveTokenResponseDto> {
        const { employees } = requestDto;

        // Context Service를 통해 일괄 토큰 제거
        const results = await this.fcmTokenManagementContextService.여러_직원의_여러_토큰을_일괄제거한다(employees);

        // 결과 집계
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        return {
            results: results.map((r) => ({
                employeeNumber: r.employeeNumber,
                fcmToken: r.fcmToken,
                success: r.success,
                error: r.error,
            })),
            totalAttempts: results.length,
            successCount,
            failCount,
        };
    }
}
