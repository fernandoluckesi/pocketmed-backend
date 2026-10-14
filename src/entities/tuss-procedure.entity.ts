import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Official ANS TUSS procedure codes (Tabela 22 - Procedimentos em Saúde),
 * seeded from the government export so Receitas can offer a searchable
 * autocomplete instead of free text. `code` is the TUSS code itself.
 */
@Entity('tuss_procedures')
export class TussProcedure {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Column({ type: 'date', nullable: true })
  validFrom: Date | null;

  @Column({ type: 'date', nullable: true })
  validUntil: Date | null;

  @Column({ type: 'date', nullable: true })
  implantedThrough: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
