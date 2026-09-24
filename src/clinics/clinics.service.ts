import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Clinic } from '../entities/clinic.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Doctor } from '../entities/doctor.entity';
import { Secretary } from '../entities/secretary.entity';
import { Appointment } from '../entities/appointment.entity';
import { ProfessionalRole } from '../auth/professional-role.enum';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { ConvertToClinicDto } from './dto/convert-to-clinic.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { UploadService } from '../upload/upload.service';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';
import { getPlan } from '../plans/plans.config';
import { StripeService } from '../payments/stripe.service';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { PaymentsService } from '../payments/payments.service';
import { buildExternalReference } from '../payments/mercadopago-reference';

/** "Active" patient: had an appointment (created or last touched) with the
 * clinic in the last 12 months — matches the plan's definition, so a clinic
 * isn't penalized just for having a large historical patient base. */
const ACTIVE_PATIENT_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    @InjectRepository(ClinicMembership)
    private clinicMembershipRepository: Repository<ClinicMembership>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Secretary)
    private secretaryRepository: Repository<Secretary>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private dataSource: DataSource,
    private uploadService: UploadService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private stripeService: StripeService,
    private mercadoPagoService: MercadoPagoService,
    private paymentsService: PaymentsService,
    private configService: ConfigService,
  ) {}

  /**
   * Creates a new clinic + doctor admin in a single transaction (public endpoint).
   * Same data as doctor registration + clinic fields.
   */
  async create(dto: CreateClinicDto, file?: Express.Multer.File) {
    // ── Validate uniqueness ─────────────────────────────────────────────────
    const conflicts: string[] = [];

    const existingEmail = await this.doctorRepository.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existingEmail) conflicts.push('email');

    const existingPhone = await this.doctorRepository.findOne({
      where: { phone: dto.phone },
    });
    if (existingPhone) conflicts.push('phone');

    const existingCrm = await this.doctorRepository.findOne({
      where: { crm: dto.crm },
    });
    if (existingCrm) conflicts.push('crm');

    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Dados já cadastrados',
        conflicts,
      });
    }

    // Check CNPJ uniqueness
    if (dto.cnpj) {
      const existingCnpj = await this.clinicRepository.findOne({
        where: { cnpj: dto.cnpj },
      });
      if (existingCnpj) {
        throw new ConflictException({
          message: 'CNPJ já cadastrado para outra clínica',
          conflicts: ['cnpj'],
        });
      }
    }

    // ── Upload profile image ────────────────────────────────────────────────
    let profileImageUrl: string | null = null;
    if (file) {
      try {
        const uploadedUrl = await this.uploadService.uploadFile(file, 'profiles');
        profileImageUrl = uploadedUrl || null;
      } catch (uploadError) {
        console.warn('Profile image upload failed, continuing without image:', uploadError.message);
        profileImageUrl = null;
      }
    }

    // ── Transaction: create doctor + clinic + membership ────────────────────
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create doctor
      const doctor = queryRunner.manager.create(Doctor, {
        name: dto.name,
        email: dto.email.trim().toLowerCase(),
        password: hashedPassword,
        gender: dto.gender,
        specialty: dto.specialty,
        cpf: dto.cpf,
        phone: dto.phone,
        birthDate: new Date(dto.birthDate),
        crm: dto.crm,
        rqe: dto.rqe || null,
        profileImage: profileImageUrl,
        type: 'doctor',
        isShadow: false,
        emailVerified: false,
      });
      const savedDoctor = await queryRunner.manager.save(doctor);

      // 2. Create clinic
      const clinic = queryRunner.manager.create(Clinic, {
        name: dto.clinicName.trim(),
        cnpj: dto.cnpj || null,
        isActive: true,
        cep: dto.cep || null,
        street: dto.street || null,
        number: dto.noNumber ? null : dto.number || null,
        complement: dto.complement || null,
        neighborhood: dto.neighborhood || null,
        city: dto.city || null,
        state: dto.state || null,
        noNumber: dto.noNumber ?? false,
      });
      const savedClinic = await queryRunner.manager.save(clinic);

      // 3. Create membership (doctor as admin)
      const membership = queryRunner.manager.create(ClinicMembership, {
        clinicId: savedClinic.id,
        professionalId: savedDoctor.id,
        role: ProfessionalRole.ADMIN,
        isActive: true,
        invitedBy: null,
      });
      await queryRunner.manager.save(membership);

      // 4. Send email verification
      const verificationCode = this.generateVerificationCode();
      savedDoctor.verificationCode = verificationCode;
      savedDoctor.verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await queryRunner.manager.save(savedDoctor);
      await this.emailService.sendEmailVerificationCode(
        dto.email.trim().toLowerCase(),
        verificationCode,
        dto.name,
      );

      await queryRunner.commitTransaction();

      // Generate JWT token
      const token = this.jwtService.sign({
        sub: savedDoctor.id,
        email: savedDoctor.email,
        type: 'doctor',
        role: ProfessionalRole.ADMIN,
        activeClinicId: savedClinic.id,
      });

      return {
        message: 'Clinic and admin account created successfully',
        user: this.sanitizeDoctor(savedDoctor),
        clinic: {
          id: savedClinic.id,
          name: savedClinic.name,
          cnpj: savedClinic.cnpj,
          isActive: savedClinic.isActive,
          cep: savedClinic.cep,
          street: savedClinic.street,
          number: savedClinic.number,
          complement: savedClinic.complement,
          neighborhood: savedClinic.neighborhood,
          city: savedClinic.city,
          state: savedClinic.state,
          noNumber: savedClinic.noNumber,
        },
        token,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Returns all clinics the authenticated doctor belongs to.
   *
   * Secretaries aren't `ClinicMembership` rows (they belong to exactly one
   * clinic via `Secretary.clinicId`), so they're resolved separately.
   */
  async findMyClinic(user: any) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can access clinics');
    }

    if (user.role === ProfessionalRole.SECRETARY) {
      const secretary = await this.secretaryRepository.findOne({
        where: { id: user.userId, isActive: true },
        relations: ['clinic'],
      });
      if (!secretary) return [];
      return [
        {
          clinicId: secretary.clinic.id,
          name: secretary.clinic.name,
          cnpj: secretary.clinic.cnpj,
          isActive: secretary.clinic.isActive,
          role: ProfessionalRole.SECRETARY,
          membershipId: secretary.id,
          joinedAt: secretary.createdAt,
        },
      ];
    }

    const memberships = await this.clinicMembershipRepository.find({
      where: { professionalId: user.userId, isActive: true },
      relations: ['clinic'],
      order: { createdAt: 'ASC' },
    });

    return memberships.map((m) => ({
      clinicId: m.clinic.id,
      name: m.clinic.name,
      cnpj: m.clinic.cnpj,
      isActive: m.clinic.isActive,
      role: m.role,
      membershipId: m.id,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Get a specific clinic by ID (must be a member, or the clinic's secretary).
   */
  async findOne(id: string, user: any) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can access clinics');
    }

    if (user.role === ProfessionalRole.SECRETARY) {
      const secretary = await this.secretaryRepository.findOne({
        where: { id: user.userId, clinicId: id, isActive: true },
        relations: ['clinic'],
      });
      if (!secretary) {
        throw new NotFoundException('Clinic not found or you are not a member');
      }
      return {
        clinic: secretary.clinic,
        role: ProfessionalRole.SECRETARY,
        membershipId: secretary.id,
      };
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: { clinicId: id, professionalId: user.userId, isActive: true },
      relations: ['clinic'],
    });

    if (!membership) {
      throw new NotFoundException('Clinic not found or you are not a member');
    }

    return {
      clinic: membership.clinic,
      role: membership.role,
      membershipId: membership.id,
    };
  }

  /**
   * Updates a clinic (admin only).
   */
  async update(id: string, dto: UpdateClinicDto, user: any) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can update clinics');
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: { clinicId: id, professionalId: user.userId, isActive: true },
    });

    if (!membership) {
      throw new NotFoundException('Clinic not found or you are not a member');
    }

    if (membership.role !== ProfessionalRole.ADMIN) {
      throw new ForbiddenException('Only clinic admins can update clinic data');
    }

    const clinic = await this.clinicRepository.findOne({ where: { id } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Check CNPJ uniqueness if changing
    if (dto.cnpj && dto.cnpj !== clinic.cnpj) {
      const existingCnpj = await this.clinicRepository.findOne({
        where: { cnpj: dto.cnpj },
      });
      if (existingCnpj && existingCnpj.id !== id) {
        throw new ConflictException('CNPJ already registered for another clinic');
      }
    }

    if (dto.name !== undefined) clinic.name = dto.name.trim();
    if (dto.cnpj !== undefined) clinic.cnpj = dto.cnpj;
    if (dto.isActive !== undefined) clinic.isActive = dto.isActive;
    if (dto.cep !== undefined) clinic.cep = dto.cep;
    if (dto.street !== undefined) clinic.street = dto.street;
    if (dto.number !== undefined) clinic.number = dto.number;
    if (dto.complement !== undefined) clinic.complement = dto.complement;
    if (dto.neighborhood !== undefined) clinic.neighborhood = dto.neighborhood;
    if (dto.city !== undefined) clinic.city = dto.city;
    if (dto.state !== undefined) clinic.state = dto.state;
    if (dto.noNumber !== undefined) clinic.noNumber = dto.noNumber;

    const updatedClinic = await this.clinicRepository.save(clinic);

    return {
      message: 'Clinic updated successfully',
      clinic: updatedClinic,
    };
  }

  /**
   * Converts the authenticated doctor's account into owning a new clinic:
   * creates the Clinic (with CNPJ, address and the chosen plan) and makes
   * the doctor its admin member. The doctor keeps any memberships they had
   * in other clinics — this only adds a new one they now own.
   */
  async convertToClinic(user: any, dto: ConvertToClinicDto) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can become a clinic');
    }

    const existingCnpj = await this.clinicRepository.findOne({
      where: { cnpj: dto.cnpj },
    });
    if (existingCnpj) {
      throw new ConflictException({
        message: 'CNPJ já cadastrado para outra clínica',
        conflicts: ['cnpj'],
      });
    }

    const doctor = await this.doctorRepository.findOne({ where: { id: user.userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const clinic = queryRunner.manager.create(Clinic, {
        name: dto.clinicName.trim(),
        cnpj: dto.cnpj,
        isActive: true,
        cep: dto.cep,
        street: dto.street,
        number: dto.noNumber ? null : dto.number || null,
        complement: dto.complement || null,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state,
        noNumber: dto.noNumber ?? false,
        planId: getPlan(dto.planId).id,
      });
      const savedClinic = await queryRunner.manager.save(clinic);

      const membership = queryRunner.manager.create(ClinicMembership, {
        clinicId: savedClinic.id,
        professionalId: doctor.id,
        role: ProfessionalRole.ADMIN,
        isActive: true,
        invitedBy: null,
      });
      await queryRunner.manager.save(membership);

      await queryRunner.commitTransaction();

      // New JWT so the frontend can switch straight into the new clinic's context.
      const token = this.jwtService.sign({
        sub: doctor.id,
        email: doctor.email,
        type: 'doctor',
        role: ProfessionalRole.ADMIN,
        activeClinicId: savedClinic.id,
      });

      return {
        message: 'Clinic created successfully',
        clinic: savedClinic,
        token,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** Current plan + usage (professionals and "active" patients) vs. the plan's limits. */
  async getSubscription(clinicId: string, user: any) {
    const membership = await this.assertMembership(clinicId, user);
    const clinic = membership.clinic;
    const plan = getPlan(clinic.planId);

    const professionalsCount = await this.clinicMembershipRepository.count({
      where: {
        clinicId,
        isActive: true,
        role: In([ProfessionalRole.DOCTOR, ProfessionalRole.ADMIN]),
      },
    });

    const clinicDoctorIds = (
      await this.clinicMembershipRepository.find({
        where: {
          clinicId,
          isActive: true,
          role: In([ProfessionalRole.DOCTOR, ProfessionalRole.ADMIN]),
        },
        select: ['professionalId'],
      })
    ).map((m) => m.professionalId);

    let activePatientsCount = 0;
    if (clinicDoctorIds.length > 0) {
      const since = new Date(Date.now() - ACTIVE_PATIENT_WINDOW_MS);
      const result = await this.appointmentRepository
        .createQueryBuilder('appointment')
        .select('COUNT(DISTINCT appointment.patientId)', 'count')
        .where('appointment.doctorId IN (:...clinicDoctorIds)', { clinicDoctorIds })
        .andWhere('appointment.patientId IS NOT NULL')
        .andWhere('(appointment.dateTime >= :since OR appointment.updatedAt >= :since)', {
          since,
        })
        .getRawOne<{ count: string }>();
      activePatientsCount = Number(result?.count || 0);
    }

    return {
      plan,
      additionalProfessionals: clinic.additionalProfessionals,
      usage: {
        professionals: professionalsCount,
        professionalsLimit:
          plan.professionalsIncluded === null
            ? null
            : plan.professionalsIncluded + clinic.additionalProfessionals,
        activePatients: activePatientsCount,
        activePatientsLimit: plan.activePatientsIncluded,
      },
      billing: {
        // Whether this clinic has ever completed a checkout — the frontend
        // uses this to decide whether "manage billing" makes sense.
        managed: clinic.mercadoPagoPreapprovalId !== null || clinic.stripeCustomerId !== null,
        status: clinic.subscriptionStatus,
        currentPeriodEnd: clinic.currentPeriodEnd,
        provider: clinic.mercadoPagoPreapprovalId
          ? 'mercadopago'
          : clinic.stripeCustomerId
            ? 'stripe'
            : null,
        gatewayAvailable:
          this.mercadoPagoService.isConfigured() || this.stripeService.isConfigured(),
      },
    };
  }

  /** Changes the clinic's plan and/or add-on seats (admin only). No payment
   * is collected here — this only records the selection. */
  async updateSubscription(clinicId: string, dto: UpdateSubscriptionDto, user: any) {
    const membership = await this.assertMembership(clinicId, user, ProfessionalRole.ADMIN);
    const clinic = membership.clinic;

    if (dto.planId !== undefined) clinic.planId = getPlan(dto.planId).id;
    if (dto.additionalProfessionals !== undefined) {
      clinic.additionalProfessionals = dto.additionalProfessionals;
    }

    const updatedClinic = await this.clinicRepository.save(clinic);

    return {
      message: 'Subscription updated successfully',
      clinic: updatedClinic,
    };
  }

  /** Starts a Stripe Checkout session to subscribe the clinic to a plan
   * (or change its add-on seats) via real payment. Prefers Mercado Pago
   * (the active gateway, PIX/boleto/cartão for Brazil); falls back to
   * Stripe if that's configured instead. Requires at least one gateway —
   * until then this is unavailable and the frontend should fall back to
   * the manual `updateSubscription` path. */
  async createCheckoutSession(clinicId: string, dto: CreateCheckoutSessionDto, user: any) {
    const useMercadoPago = this.mercadoPagoService.isConfigured();
    if (!useMercadoPago && !this.stripeService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured yet (no MERCADOPAGO_ACCESS_TOKEN or STRIPE_SECRET_KEY)',
      );
    }

    const membership = await this.assertMembership(clinicId, user, ProfessionalRole.ADMIN);
    const clinic = membership.clinic;
    const plan = getPlan(dto.planId);

    if (plan.price === null) {
      throw new BadRequestException(
        `Plan "${plan.id}" has no self-serve price configured (Enterprise is negotiated manually)`,
      );
    }

    const doctor = await this.doctorRepository.findOne({ where: { id: user.userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const additionalProfessionals = dto.additionalProfessionals || 0;

    if (useMercadoPago) {
      const amount = plan.price + (plan.additionalProfessionalPrice || 0) * additionalProfessionals;

      // Mercado Pago rejects a non-HTTPS back_url outright. In local dev
      // (FRONTEND_URL still http://localhost) there's no reachable HTTPS
      // callback yet, so fall back to Mercado Pago's own domain — the
      // payment is authorized server-side regardless of where the browser
      // lands afterwards; the frontend also offers a manual "check status"
      // action for exactly this case (see Account page's subscription tab).
      const backUrl = frontendUrl.startsWith('https://')
        ? `${frontendUrl}/account?tab=subscription&checkout=success`
        : 'https://www.mercadopago.com.br';

      const subscription = await this.mercadoPagoService.createSubscription({
        reason: `Hispora — Plano ${plan.name}`,
        amount,
        payerEmail: doctor.email,
        externalReference: buildExternalReference({
          clinicId: clinic.id,
          planId: plan.id,
          additionalProfessionals,
        }),
        backUrl,
      });

      clinic.mercadoPagoPreapprovalId = subscription.id;
      await this.clinicRepository.save(clinic);

      return { url: subscription.initPoint };
    }

    const priceId = this.stripeService.getPriceId(plan.id);
    if (!priceId) {
      throw new BadRequestException(`Plan "${plan.id}" has no self-serve Stripe price configured`);
    }

    if (!clinic.stripeCustomerId) {
      clinic.stripeCustomerId = await this.stripeService.createCustomer({
        email: doctor.email,
        name: clinic.name,
        clinicId: clinic.id,
      });
      await this.clinicRepository.save(clinic);
    }

    const addonPriceId = this.stripeService.getAddonPriceId(plan.id);

    return this.stripeService.createCheckoutSession({
      customerId: clinic.stripeCustomerId,
      clinicId: clinic.id,
      planId: plan.id,
      priceId,
      addonPriceId,
      addonQuantity: additionalProfessionals,
      successUrl: `${frontendUrl}/account?tab=subscription&checkout=success`,
      cancelUrl: `${frontendUrl}/account?tab=subscription&checkout=canceled`,
    });
  }

  /** Cancels the clinic's active subscription. Mercado Pago has no hosted
   * self-service portal like Stripe, so cancellation happens directly via
   * API instead of a redirect. */
  async cancelSubscription(clinicId: string, user: any) {
    const membership = await this.assertMembership(clinicId, user, ProfessionalRole.ADMIN);
    const clinic = membership.clinic;

    if (!clinic.mercadoPagoPreapprovalId) {
      throw new BadRequestException('This clinic has no active gateway subscription to cancel');
    }

    await this.mercadoPagoService.cancelSubscription(clinic.mercadoPagoPreapprovalId);
    clinic.subscriptionStatus = 'cancelled';
    await this.clinicRepository.save(clinic);

    return { message: 'Subscription cancelled successfully' };
  }

  /** Re-fetches the clinic's subscription status directly from the gateway
   * — called by the frontend right after returning from checkout, since a
   * webhook isn't guaranteed to have arrived yet (and can't reach
   * localhost at all in local development). */
  async syncSubscription(clinicId: string, user: any) {
    const membership = await this.assertMembership(clinicId, user, ProfessionalRole.ADMIN);
    const clinic = membership.clinic;

    if (clinic.mercadoPagoPreapprovalId) {
      await this.paymentsService.syncMercadoPagoSubscription(clinic.mercadoPagoPreapprovalId);
    }

    return this.getSubscription(clinicId, user);
  }

  /** Opens the Stripe-hosted billing portal (invoices, payment method,
   * cancellation) — only reachable when Stripe is the active gateway. */
  async createBillingPortalSession(clinicId: string, user: any) {
    if (!this.stripeService.isConfigured()) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const membership = await this.assertMembership(clinicId, user, ProfessionalRole.ADMIN);
    const clinic = membership.clinic;

    if (!clinic.stripeCustomerId) {
      throw new BadRequestException(
        'This clinic has no billing set up yet — subscribe to a plan first',
      );
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    return this.stripeService.createBillingPortalSession({
      customerId: clinic.stripeCustomerId,
      returnUrl: `${frontendUrl}/account?tab=subscription`,
    });
  }

  private async assertMembership(clinicId: string, user: any, requiredRole?: ProfessionalRole) {
    if (user.type !== 'doctor') {
      throw new ForbiddenException('Only professional accounts can access clinics');
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: { clinicId, professionalId: user.userId, isActive: true },
      relations: ['clinic'],
    });

    if (!membership) {
      throw new NotFoundException('Clinic not found or you are not a member');
    }

    if (requiredRole && membership.role !== requiredRole) {
      throw new ForbiddenException('Only clinic admins can manage the subscription');
    }

    return membership;
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitizeDoctor(doctor: Doctor) {
    const {
      password,
      verificationCode,
      verificationCodeExpiry,
      passwordResetCode,
      passwordResetCodeExpiry,
      ...safeDoctor
    } = doctor as any;
    return safeDoctor;
  }
}
