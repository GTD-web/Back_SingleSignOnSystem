import { Injectable, Logger } from '@nestjs/common';
import { IRepository } from '../interfaces/repository.interface';
import { IService } from '../interfaces/service.interface';
import { IRepositoryOptions } from '../interfaces/repository.interface';
import { ObjectLiteral, DeepPartial } from 'typeorm';
import { BaseRepository } from '../repositories/base.repository';

@Injectable()
export abstract class BaseService<T extends ObjectLiteral> implements IService<T> {
    protected constructor(protected readonly repository: IRepository<T>) {}

    // QueryBuilder 접근을 위한 메서드
    createQueryBuilder(alias?: string) {
        return (this.repository as BaseRepository<T>).createQueryBuilder(alias);
    }

    // Transaction Manager 접근을 위한 메서드
    get manager() {
        return (this.repository as BaseRepository<T>).manager;
    }

    async create(entity: DeepPartial<T>, options?: IRepositoryOptions<T>): Promise<T> {
        return this.repository.create(entity, options);
    }

    async save(entity: DeepPartial<T>, options?: IRepositoryOptions<T>): Promise<T> {
        return this.repository.save(entity, options);
    }

    async findAll(options?: IRepositoryOptions<T>): Promise<T[]> {
        return this.repository.findAll(options);
    }

    async findOne(options: IRepositoryOptions<T>): Promise<T | null> {
        return this.repository.findOne(options);
    }

    async update(entityId: string, entity: Partial<T>, options?: IRepositoryOptions<T>): Promise<T> {
        return this.repository.update(entityId, entity, options);
    }

    async delete(entityId: string, options?: IRepositoryOptions<T>): Promise<void> {
        return this.repository.delete(entityId, options);
    }
}
