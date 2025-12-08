import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ranks')
export class Rank {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ comment: '직급명' })
    rankName: string;

    @Column({ unique: true, comment: '직급 코드' })
    rankCode: string;

    @Column({ comment: '직급 레벨 (낮을수록 상위 직급)' })
    level: number;

    @CreateDateColumn({ comment: '생성일' })
    createdAt: Date;

    @UpdateDateColumn({ comment: '수정일' })
    updatedAt: Date;

    // 직원 관계는 이력 테이블로 분리

    // ==================== Setter 메서드 ====================

    /**
     * 직급명을설정한다
     */
    직급명을설정한다(rankName: string): void {
        this.rankName = rankName;
    }

    /**
     * 직급코드를설정한다
     */
    직급코드를설정한다(rankCode: string): void {
        this.rankCode = rankCode;
    }

    /**
     * 레벨을설정한다
     */
    레벨을설정한다(level: number): void {
        this.level = level;
    }
}
