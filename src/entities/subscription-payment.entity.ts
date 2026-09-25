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
import { Clinic } from './clinic.entity';

/**
 * One row per individual gateway charge (not per subscription) — a clinic's
 * recurring plan generates a new payment every billing cycle. This is
 * Hispora's OWN record of money it received from clinics (subscription
 * revenue), distinct from `FinancialRevenue` (a clinic's patient billing).
 *
 * Populated primarily by the gateway webhook in near-real-time, with a
 * daily reconciliation cron as a safety net for any missed notification —
 * see `PaymentsCronService`.
 */
@Entity('subscription_payments')
@Unique(['provider', 'externalPaymentId'])
export class SubscriptionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  clinicId: string;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  /** The gateway's own payment id (Mercado Pago's numeric payment id, as a string). */
  @Column({ type: 'varchar', length: 50 })
  externalPaymentId: string;

  /** The subscription (preapproval) this charge belongs to. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  preapprovalId: string | null;

  /** approved / pending / rejected / refunded / cancelled / in_process (MP's payment statuses). */
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  statusDetail: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  transactionAmount: number;

  /** Amount actually credited to Hispora after the gateway's fee. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  netReceivedAmount: number | null;

  /** Total of all fee_details entries (gateway's cut). */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  feeAmount: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currencyId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethodId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentTypeId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'datetime', nullable: true })
  dateCreated: Date | null;

  @Column({ type: 'datetime', nullable: true })
  dateApproved: Date | null;

  /** When the gateway actually releases these funds to Hispora's balance —
   * the real cash-flow-relevant date, distinct from dateApproved. */
  @Column({ type: 'datetime', nullable: true })
  moneyReleaseDate: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  moneyReleaseStatus: string | null;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
