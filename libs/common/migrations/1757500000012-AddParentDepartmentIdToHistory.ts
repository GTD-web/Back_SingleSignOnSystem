import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddParentDepartmentIdToHistory1757500000012 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // employee_department_position_history 테이블에 parentDepartmentId 컬럼 추가
        await queryRunner.addColumn(
            'employee_department_position_history',
            new TableColumn({
                name: 'parentDepartmentId',
                type: 'uuid',
                isNullable: true,
                comment: '해당 시점의 부서 상위 부서 ID (조직 계층 구조 추적용)',
            }),
        );

        // 외래 키 제약 조건 추가 (employee_department_position_history)
        await queryRunner.createForeignKey(
            'employee_department_position_history',
            new TableForeignKey({
                name: 'FK_emp_dept_pos_hist_parent_dept',
                columnNames: ['parentDepartmentId'],
                referencedTableName: 'departments',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 외래 키 제거
        await queryRunner.dropForeignKey('employee_department_position_history', 'FK_emp_dept_pos_hist_parent_dept');

        // 컬럼 제거
        await queryRunner.dropColumn('employee_department_position_history', 'parentDepartmentId');
    }
}
