import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { FcmToken } from '../../../../libs/database/entities';
import { BaseRepository } from '../../../../libs/common/repositories/base.repository';
import { IRepositoryOptions } from '../../../../libs/common/interfaces/repository.interface';

@Injectable()
export class DomainFcmTokenRepository extends BaseRepository<FcmToken> {
    constructor(
        @InjectRepository(FcmToken)
        repository: Repository<FcmToken>,
    ) {
        super(repository);
    }

    deleteInactiveTokens(repositoryOptions?: IRepositoryOptions<FcmToken>): Promise<DeleteResult> {
        const repository = repositoryOptions?.queryRunner
            ? repositoryOptions.queryRunner.manager.getRepository(this.repository.target)
            : this.repository;
        return repository.delete({
            isActive: false,
        });
    }

    /**
     * 직원ID와 디바이스 타입으로 기존 FCM 토큰 조회
     */
    async findByEmployeeAndDeviceType(
        employeeId: string,
        deviceType: string,
        deviceInfo: string,
    ): Promise<FcmToken | null> {
        return this.repository
            .createQueryBuilder('fcmToken')
            .innerJoin('employee_fcm_tokens', 'eft', 'eft.fcmTokenId = fcmToken.id')
            .where('eft.employeeId = :employeeId', { employeeId })
            .andWhere('fcmToken.deviceType = :deviceType', { deviceType })
            .andWhere('fcmToken.deviceInfo = :deviceInfo', { deviceInfo })
            .andWhere('fcmToken.isActive = :isActive', { isActive: true })
            .getOne();
    }

    /**
     * 직원ID와 디바이스 타입으로 기존 FCM 토큰 조회
     */
    async findByEmployeeAndFcmToken(employeeId: string, fcmToken: string): Promise<FcmToken | null> {
        return this.repository
            .createQueryBuilder('fcmToken')
            .innerJoin('employee_fcm_tokens', 'eft', 'eft.fcmTokenId = fcmToken.id')
            .where('eft.employeeId = :employeeId', { employeeId })
            .andWhere('fcmToken.fcmToken = :fcmToken', { fcmToken })
            .getOne();
    }

    /**
     * employee_fcm_tokens 테이블에 연결되지 않은 고아 토큰 삭제
     */
    async deleteOrphanTokens(): Promise<number> {
        const result = await this.repository
            .createQueryBuilder('fcmToken')
            .delete()
            .where('id NOT IN (SELECT DISTINCT "fcmTokenId" FROM employee_fcm_tokens WHERE "fcmTokenId" IS NOT NULL)')
            .execute();

        return result.affected || 0;
    }
}
