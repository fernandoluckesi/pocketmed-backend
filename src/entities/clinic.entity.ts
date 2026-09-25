import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ClinicMembership } from './clinic-membership.entity';

@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 18, nullable: true })
  cnpj: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 9, nullable: true })
  cep: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  street: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  complement: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  neighborhood: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ type: 'boolean', default: false })
  noNumber: boolean;

  /** Which of the 5 fixed plans (starter/plus/pro/premium/enterprise) the
   * clinic subscribes to — see src/plans/plans.config.ts. */
  @Column({ type: 'varchar', length: 20, default: 'starter' })
  planId: string;

  /** Extra professional seats bought beyond the plan's included limit. */
  @Column({ type: 'int', default: 0 })
  additionalProfessionals: number;

  /** Stripe customer id, created on the clinic's first checkout. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeCustomerId: string | null;

  /** Stripe subscription id backing the current plan, once billed via Stripe. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId: string | null;

  /** Mirrors the active gateway's subscription status — Mercado Pago
   * (pending/authorized/paused/cancelled) or Stripe (active/past_due/...).
   * `null` means the plan was set manually and isn't billed through a gateway. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  subscriptionStatus: string | null;

  @Column({ type: 'datetime', nullable: true })
  currentPeriodEnd: Date | null;

  /** Mercado Pago subscription (preapproval) id — the active gateway. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  mercadoPagoPreapprovalId: string | null;

  /** The `external_reference` sent when creating the preapproval above —
   * kept around because Mercado Pago's payment search filters by this
   * value, not by preapproval id (used by the reconciliation cron). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  mercadoPagoExternalReference: string | null;

  @OneToMany(() => ClinicMembership, (membership) => membership.clinic)
  memberships: ClinicMembership[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
