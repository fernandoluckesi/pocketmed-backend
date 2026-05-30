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

@Entity('financial_doctor_transfers')
export class FinancialDoctorTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clinicId: string;

  @Column({ type: 'varchar', length: 36 })
  doctorId: string;

  @Column({ type: 'varchar', length: 7 })
  referenceMonth: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalRevenue: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  transferPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  transferAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  deductions: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netTransfer: number;

  @Column({ type: 'int' })
  proceduresCount: number;

  @Column({ type: 'varchar', length: 20, default: 'CALCULADO' })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  paymentProof: string | null;

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
