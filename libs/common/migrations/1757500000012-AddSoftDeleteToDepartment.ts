import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddSoftDeleteToDepartment1757500000012 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // @DeleteDateColumn 데코레이터가 기대하는 스키마와 동일하게 정의
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

        // Soft Delete용 부분 인덱스 (삭제되지 않은 레코드만 인덱싱)
        await queryRunner.createIndex(
            'departments',
            new TableIndex({
                name: 'IDX_departments_not_deleted',
                columnNames: ['id'],
                where: '"deletedAt" IS NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('departments', 'IDX_departments_not_deleted');
        await queryRunner.dropColumn('departments', 'deletedAt');
    }
}
