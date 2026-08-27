import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ClinicDoctorInvite, InviteStatus } from './entities/clinic-doctor-invite.entity';

@Injectable()
export class InviteExpirationScheduler {
  private readonly logger = new Logger(InviteExpirationScheduler.name);

  constructor(
    @InjectRepository(ClinicDoctorInvite)
    private readonly inviteRepository: Repository<ClinicDoctorInvite>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleExpiration(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.inviteRepository.update(
        {
          status: InviteStatus.PENDING,
          createdAt: LessThan(thirtyDaysAgo),
        },
        { status: InviteStatus.EXPIRED },
      );

      const expiredCount = result.affected || 0;
      this.logger.log(`Expired ${expiredCount} pending invite(s) older than 30 days.`);
    } catch (error) {
      this.logger.error('Failed to expire pending invites', error?.stack || error);
    }
  }
}
