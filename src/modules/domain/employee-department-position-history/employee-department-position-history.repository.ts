import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../../libs/common/repositories/base.repository';
import { EmployeeDepartmentPositionHistory } from './employee-department-position-history.entity';

@Injectable()
export class DomainEmployeeDepartmentPositionHistoryRepository extends BaseRepository<EmployeeDepartmentPositionHistory> {
    constructor(
        @InjectRepository(EmployeeDepartmentPositionHistory)
        repository: Repository<EmployeeDepartmentPositionHistory>,
    ) {
        super(repository);
    }
}

