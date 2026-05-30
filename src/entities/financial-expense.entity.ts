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
import { FinancialCostCenter } from './financial-cost-center.entity';

@Entity('financial_expenses')
export class FinancialExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clinicId: string;

  @Column({ type: 'varchar', length: 36 })
  costCenterId: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subcategory: string | null;

  @Column({ type: 'varchar', length: 255 })
  provider: string;

  @Column({ type: 'varchar', length: 18, nullable: true })
  providerCnpj: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  taxValue: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netValue: number;

  @Column({ type: 'varchar', length: 30 })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDENTE' })
  status: string;

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'UNICA' })
  recurrence: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  attachmentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => FinancialCostCenter)
  @JoinColumn({ name: 'costCenterId' })
  costCenter: FinancialCostCenter;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
