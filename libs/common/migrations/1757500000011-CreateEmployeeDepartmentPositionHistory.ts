import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateEmployeeDepartmentPositionHistory1757500000011 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // employee_department_position_history 테이블 생성
        await queryRunner.createTable(
            new Table({
                name: 'employee_department_position_history',
                columns: [
                    {
                        name: 'historyId',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'gen_random_uuid()',
                    },
                    {
                        name: 'employeeId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'departmentId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'positionId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'rankId',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'isManager',
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
                        name: 'assignmentReason',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'assignedBy',
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
            'employee_department_position_history',
            new TableIndex({
                name: 'IDX_emp_dept_pos_hist_emp_dates',
                columnNames: ['employeeId', 'effectiveStartDate', 'effectiveEndDate'],
            }),
        );

        await queryRunner.createIndex(
            'employee_department_position_history',
            new TableIndex({
                name: 'IDX_emp_dept_pos_hist_dept_dates',
                columnNames: ['departmentId', 'effectiveStartDate', 'effectiveEndDate'],
            }),
        );

        await queryRunner.createIndex(
            'employee_department_position_history',
            new TableIndex({
                name: 'IDX_emp_dept_pos_hist_current',
                columnNames: ['isCurrent', 'employeeId'],
                where: '"isCurrent" = true',
            }),
        );

        // 외래 키 생성
        await queryRunner.createForeignKey(
            'employee_department_position_history',
            new TableForeignKey({
                columnNames: ['employeeId'],
                referencedTableName: 'employees',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'employee_department_position_history',
            new TableForeignKey({
                columnNames: ['departmentId'],
                referencedTableName: 'departments',
                referencedColumnNames: ['id'],
            }),
        );

        await queryRunner.createForeignKey(
            'employee_department_position_history',
            new TableForeignKey({
                columnNames: ['positionId'],
                referencedTableName: 'positions',
                referencedColumnNames: ['id'],
            }),
        );

        await queryRunner.createForeignKey(
            'employee_department_position_history',
            new TableForeignKey({
                columnNames: ['rankId'],
                referencedTableName: 'ranks',
                referencedColumnNames: ['id'],
            }),
        );

        // 기존 EmployeeDepartmentPosition 데이터를 History로 마이그레이션
        await queryRunner.query(`
            INSERT INTO employee_department_position_history (
                "employeeId",
                "departmentId",
                "positionId",
                "rankId",
                "isManager",
                "effectiveStartDate",
                "effectiveEndDate",
                "isCurrent",
                "assignmentReason"
            )
            SELECT
                edp."employeeId",
                edp."departmentId",
                edp."positionId",
                e."currentRankId",
                edp."isManager",
                COALESCE(edp."createdAt"::date, e."hireDate", '2020-01-01'),
                NULL,
                true,
                '초기 데이터 마이그레이션'
            FROM employee_department_positions edp
            JOIN employees e ON edp."employeeId" = e.id
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('employee_department_position_history');
    }
}
