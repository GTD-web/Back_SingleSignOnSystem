import { Injectable, ConflictException } from '@nestjs/common';
import { DomainFcmTokenRepository } from './fcm-token.repository';
import { BaseService } from '../../../../libs/common/services/base.service';
import { FcmToken } from './fcm-token.entity';
// DeviceType enum 제거 - 이제 문자열로 처리

@Injectable()
export class DomainFcmTokenService extends BaseService<FcmToken> {
    constructor(private readonly fcmTokenRepository: DomainFcmTokenRepository) {
        super(fcmTokenRepository);
    }

    // FCM 토큰으로 조회
    async findByFcmToken(fcmToken: string): Promise<FcmToken | null> {
        return this.fcmTokenRepository.findOne({
            where: { fcmToken },
        });
    }

    // 직원ID와 디바이스 타입으로 기존 FCM 토큰 조회
    async findByEmployeeAndDeviceType(
        employeeId: string,
        deviceType: string,
        deviceInfo: string,
    ): Promise<FcmToken | null> {
        return this.fcmTokenRepository.findByEmployeeAndDeviceType(employeeId, deviceType, deviceInfo);
    }

    /**
     * 직원ID와 디바이스 타입으로 FCM 토큰 생성 또는 업데이트
     * 기존에 해당 직원의 같은 디바이스 타입 토큰이 있으면 fcmToken 값을 업데이트
     * 없으면 새로 생성
     */
    async createOrFindByEmployeeAndDevice(
        employeeId: string,
        fcmToken: string,
        deviceType: string,
        deviceInfo: string,
    ): Promise<FcmToken> {
        // 병렬로 두 조회 실행 (성능 개선)
        const [existingToken, tokenWithSameFcmToken] = await Promise.all([
            this.fcmTokenRepository.findByEmployeeAndFcmToken(employeeId, fcmToken),
            this.fcmTokenRepository.findOne({
                where: { fcmToken },
            }),
        ]);

        // 케이스 1: 기존 토큰이 있는 경우
        if (existingToken) {
            if (existingToken.deviceType === deviceType && existingToken.deviceInfo === deviceInfo) {
                return existingToken;
            }
            return this.fcmTokenRepository.update(existingToken.id, {
                deviceType,
                deviceInfo,
            });
        }

        // 케이스 2: 기존 토큰이 없고, 동일한 fcmToken이 다른 레코드에 있는 경우
        if (tokenWithSameFcmToken) {
            // 기존 fcmToken 레코드의 디바이스 정보 업데이트
            throw new ConflictException('FCM 토큰이 이미 등록되어 있습니다. 기기와 사용자를 확인해 주세요.');
        }

        // 케이스 3: 둘 다 없으면 새로 생성
        try {
            return await this.fcmTokenRepository.save({
                fcmToken,
                deviceType,
                deviceInfo,
            });
        } catch (error) {
            // unique constraint 위반 시 기존 토큰 조회 후 반환
            // if (error.code === '23505') {
            //     const token = await this.findByFcmToken(fcmToken);
            //     if (token) {
            //         return token;
            //     }
            // }
            throw new ConflictException('FCM 토큰을 생성할 수 없습니다.');
        }
    }

    /**
     * @deprecated 기존 메서드는 fcmToken으로만 중복 체크합니다. createOrFindByEmployeeAndDevice 사용을 권장합니다.
     * FCM 토큰 생성 또는 조회 (기존 방식)
     */
    async createOrFind(fcmToken: string, deviceType: string = 'pc', deviceInfo?: any): Promise<FcmToken> {
        const existingToken = await this.findByFcmToken(fcmToken);

        if (existingToken) {
            // 기존 토큰이 있으면 디바이스 정보 업데이트
            return this.fcmTokenRepository.update(existingToken.id, {
                deviceType,
                deviceInfo,
                isActive: true,
            });
        }

        try {
            return await this.fcmTokenRepository.save({
                fcmToken,
                deviceType,
                deviceInfo,
                isActive: true,
            });
        } catch (error) {
            // 중복 키 오류인 경우 다시 조회해서 반환
            if (error.code === '23505') {
                // PostgreSQL unique constraint error
                const token = await this.findByFcmToken(fcmToken);
                if (token) {
                    return token;
                }
            }
            throw error;
        }
    }

    // 디바이스 타입별 활성 토큰 조회
    async findByDeviceType(deviceType: string): Promise<FcmToken[]> {
        return this.fcmTokenRepository.findAll({
            where: { deviceType, isActive: true },
        });
    }

    // FCM 토큰 비활성화
    async deactivateToken(fcmToken: string): Promise<FcmToken> {
        const token = await this.findByFcmToken(fcmToken);

        if (!token) {
            throw new ConflictException('FCM 토큰을 찾을 수 없습니다.');
        }

        return this.fcmTokenRepository.update(token.id, {
            isActive: false,
        });
    }

    // 비활성 토큰 정리
    async cleanupInactiveTokens(): Promise<void> {
        await this.fcmTokenRepository.deleteInactiveTokens({
            where: { isActive: false },
        });
    }

    // 토큰 유효성 검증
    validateFcmToken(fcmToken: string): boolean {
        // FCM 토큰 형식 검증
        if (!fcmToken || typeof fcmToken !== 'string') {
            return false;
        }

        // FCM 토큰은 일반적으로 152자 이상
        if (fcmToken.length < 140) {
            return false;
        }

        // 기본적인 형식 검증 (영문, 숫자, 특수문자 조합)
        const fcmTokenPattern = /^[A-Za-z0-9:_-]+$/;
        return fcmTokenPattern.test(fcmToken);
    }

    // 활성 토큰 수 조회
    async countActiveTokens(): Promise<number> {
        return this.fcmTokenRepository.count({
            where: { isActive: true },
        });
    }

    // 디바이스 타입별 토큰 수 조회
    async countTokensByDeviceType(): Promise<Record<string, number>> {
        const counts = await Promise.all([
            this.fcmTokenRepository.count({
                where: { deviceType: 'android', isActive: true },
            }),
            this.fcmTokenRepository.count({
                where: { deviceType: 'ios', isActive: true },
            }),
            this.fcmTokenRepository.count({
                where: { deviceType: 'pc', isActive: true },
            }),
            this.fcmTokenRepository.count({
                where: { deviceType: 'web', isActive: true },
            }),
        ]);

        return {
            android: counts[0],
            ios: counts[1],
            pc: counts[2],
            web: counts[3],
        };
    }

    // 디바이스 타입별 통계 조회 (컨텍스트용)
    async getStatisticsByDeviceType(): Promise<{ deviceType: string; count: number }[]> {
        const counts = await this.countTokensByDeviceType();

        return Object.entries(counts).map(([deviceType, count]) => ({
            deviceType,
            count,
        }));
    }

    // FCM 토큰 삭제 (ID로)
    async delete(id: string): Promise<void> {
        await this.fcmTokenRepository.delete(id);
    }

    // employee_fcm_tokens 테이블에 연결되지 않은 고아 토큰 삭제
    async deleteOrphanTokens(): Promise<number> {
        return this.fcmTokenRepository.deleteOrphanTokens();
    }
}
