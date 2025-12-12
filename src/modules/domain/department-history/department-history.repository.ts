import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../../libs/common/repositories/base.repository';
import { DepartmentHistory } from './department-history.entity';

@Injectable()
export class DomainDepartmentHistoryRepository extends BaseRepository<DepartmentHistory> {
    constructor(
        @InjectRepository(DepartmentHistory)
        repository: Repository<DepartmentHistory>,
    ) {
        super(repository);
    }
}
