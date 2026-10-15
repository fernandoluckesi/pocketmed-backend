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
 * A convênio's own insurance plans (e.g. "Premium", "Básico"), registered per
 * clinic so the Plano field in Receitas can be a select instead of free text.
 */
@Entity('financial_convenio_plans')
@Unique('UQ_convenio_plan_name', ['convenioId', 'name'])
export class FinancialConvenioPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clinicId: string;

  @Column({ type: 'varchar', length: 36 })
  convenioId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

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
