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

@Entity('financial_settings')
export class FinancialSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clinicId: string;

  @Column({ type: 'varchar', length: 30 })
  taxRegime: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  issRate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  dasRate: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  irpjRate: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  csllRate: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  defaultDoctorTransferPercentage: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bankAgency: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankAccount: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pixKey: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  invoicePrefix: string | null;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
