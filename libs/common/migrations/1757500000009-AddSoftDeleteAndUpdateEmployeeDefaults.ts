import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddSoftDeleteAndUpdateEmployeeDefaults1757500000009 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. departments 테이블에 soft delete 컬럼 추가
        await queryRunner.addColumn(
            'departments',
            new TableColumn({
                name: 'deletedAt',
                type: 'timestamp',
                isNullable: true,
                default: null,
                comment: '삭제일',
            }),
        );

        // 2. Soft Delete용 부분 인덱스 (삭제되지 않은 레코드만 인덱싱)
        await queryRunner.createIndex(
            'departments',
            new TableIndex({
                name: 'IDX_departments_not_deleted',
                columnNames: ['id'],
                where: '"deletedAt" IS NULL',
            }),
        );

        // 3. employees 테이블의 isInitialPasswordSet 기본값을 true로 변경
        await queryRunner.query(`
            ALTER TABLE "employees" 
            ALTER COLUMN "isInitialPasswordSet" SET DEFAULT true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백 순서: 역순으로 진행

        // 1. employees 테이블의 isInitialPasswordSet 기본값을 false로 되돌림
        await queryRunner.query(`
            ALTER TABLE "employees" 
            ALTER COLUMN "isInitialPasswordSet" SET DEFAULT false
        `);

        // 2. departments 테이블의 soft delete 인덱스 및 컬럼 삭제
        await queryRunner.dropIndex('departments', 'IDX_departments_not_deleted');
        await queryRunner.dropColumn('departments', 'deletedAt');
    }
}
