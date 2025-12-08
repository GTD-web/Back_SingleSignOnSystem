import { DataSource, QueryRunner } from 'typeorm';

/**
 * 트랜잭션을 관리하는 유틸리티 함수
 * 
 * @param dataSource - TypeORM DataSource
 * @param work - 트랜잭션 내에서 실행할 작업
 * @param externalQueryRunner - 외부에서 전달받은 QueryRunner (옵션)
 * @returns 작업 결과
 * 
 * @description
 * - externalQueryRunner가 있으면 외부 트랜잭션에 참여
 * - externalQueryRunner가 없으면 새 트랜잭션 시작
 * - 자동으로 commit/rollback/release 처리
 */
export async function withTransaction<T>(
    dataSource: DataSource,
    work: (queryRunner: QueryRunner) => Promise<T>,
    externalQueryRunner?: QueryRunner,
): Promise<T> {
    if (externalQueryRunner) {
        // 외부 트랜잭션에 참여
        return await work(externalQueryRunner);
    }

    // 새 트랜잭션 시작
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const result = await work(queryRunner);
        await queryRunner.commitTransaction();
        return result;
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }
}

