import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { FinancialConvenio } from './financial-convenio.entity';

/**
 * A clinic's own remuneration table for a given convênio: how much that
 * specific operadora pays for a given procedure code, since this varies by
 * operadora and isn't the same as the procedure's "table" price.
 */
@Entity('financial_convenio_procedures')
@Unique('UQ_convenio_procedure_code', ['convenioId', 'procedureCode'])
export class FinancialConvenioProcedure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clinicId: string;

  @Column({ type: 'varchar', length: 36 })
  convenioId: string;

  @Column({ type: 'varchar', length: 20 })
  procedureCode: string;

  @Column({ type: 'varchar', length: 255 })
  procedureName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ManyToOne(() => FinancialConvenio)
  @JoinColumn({ name: 'convenioId' })
  convenio: FinancialConvenio;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
