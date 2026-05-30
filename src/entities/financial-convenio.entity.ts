import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Clinic } from './clinic.entity';

@Entity('financial_convenios')
export class FinancialConvenio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clinicId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  ansCode: string;

  @Column({ type: 'varchar', length: 18, nullable: true })
  cnpj: string | null;

  @Column({ type: 'varchar', length: 20 })
  contractTable: string;

  @Column({ type: 'int' })
  paymentTerm: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  glosaTolerance: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  markupPercentage: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contactPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Column({ type: 'date', nullable: true })
  contractStartDate: Date | null;

  @Column({ type: 'date', nullable: true })
  contractEndDate: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
