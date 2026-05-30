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
import { FinancialConvenio } from './financial-convenio.entity';

@Entity('financial_revenues')
export class FinancialRevenue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clinicId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  patientId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  doctorId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  appointmentId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  convenioId: string | null;

  @Column({ type: 'varchar', length: 255 })
  procedure: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  procedureCode: string | null;

  @Column({ type: 'varchar', length: 100 })
  specialty: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: 0 })
  discountValue: number | null;

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

  @Column({ type: 'varchar', length: 50, nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  guideNumber: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  glosaValue: number | null;

  @Column({ type: 'text', nullable: true })
  glosaReason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => FinancialConvenio)
  @JoinColumn({ name: 'convenioId' })
  convenio: FinancialConvenio;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
