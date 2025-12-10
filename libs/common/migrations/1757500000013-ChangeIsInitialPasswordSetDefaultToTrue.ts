import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeIsInitialPasswordSetDefaultToTrue1757500000013 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // isInitialPasswordSet 컬럼의 기본값을 true로 변경
        await queryRunner.query(`
            ALTER TABLE "employees" 
            ALTER COLUMN "isInitialPasswordSet" SET DEFAULT true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백: 기본값을 false로 되돌림
        await queryRunner.query(`
            ALTER TABLE "employees" 
            ALTER COLUMN "isInitialPasswordSet" SET DEFAULT false
        `);
    }
}

