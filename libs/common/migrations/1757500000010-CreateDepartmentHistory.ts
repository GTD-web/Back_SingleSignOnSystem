import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateDepartmentHistory1757500000010 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // department_history 테이블 생성
        await queryRunner.createTable(
            new Table({
                name: 'department_history',
                columns: [
                    {
                        name: 'historyId',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'gen_random_uuid()',
                    },
                    {
                        name: 'departmentId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'departmentName',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'departmentCode',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'type',
                        type: 'enum',
                        enum: ['COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM'],
                        default: "'DEPARTMENT'",
                    },
                    {
                        name: 'parentDepartmentId',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'order',
                        type: 'integer',
                        default: 0,
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'isException',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'effectiveStartDate',
                        type: 'date',
                        isNullable: false,
                    },
                    {
                        name: 'effectiveEndDate',
                        type: 'date',
                        isNullable: true,
                    },
                    {
                        name: 'isCurrent',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'changeReason',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'changedBy',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // 인덱스 생성
        await queryRunner.createIndex(
            'department_history',
            new TableIndex({
                name: 'IDX_dept_hist_id_dates',
                columnNames: ['departmentId', 'effectiveStartDate'],
            }),
        );

        await queryRunner.createIndex(
            'department_history',
            new TableIndex({
                name: 'IDX_dept_hist_dates',
                columnNames: ['effectiveStartDate', 'effectiveEndDate'],
            }),
        );

        await queryRunner.createIndex(
            'department_history',
            new TableIndex({
                name: 'IDX_dept_hist_current',
                columnNames: ['isCurrent'],
                where: '"isCurrent" = true',
            }),
        );

        // 외래 키 생성
        await queryRunner.createForeignKey(
            'department_history',
            new TableForeignKey({
                columnNames: ['departmentId'],
                referencedTableName: 'departments',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // 기존 Department 데이터를 DepartmentHistory로 마이그레이션
        await queryRunner.query(`
            INSERT INTO department_history (
                "departmentId",
                "departmentName",
                "departmentCode",
                "type",
                "parentDepartmentId",
                "order",
                "isActive",
                "isException",
                "effectiveStartDate",
                "effectiveEndDate",
                "isCurrent",
                "changeReason"
            )
            SELECT
                id,
                "departmentName",
                "departmentCode",
                type,
                "parentDepartmentId",
                "order",
                "isActive",
                "isException",
                COALESCE("createdAt"::date, '2020-01-01'),
                NULL,
                true,
                '초기 데이터 마이그레이션'
            FROM departments
            WHERE "isActive" = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('department_history');
    }
}

