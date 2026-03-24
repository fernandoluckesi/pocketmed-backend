import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from '../entities/device-token.entity';
import { AccessRequestStatus } from '../entities/doctor-access-request.entity';
import { AppointmentStatus } from '../entities/appointment.entity';
import { Notification } from '../entities/notification.entity';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';

export interface PushPayload {
  type: string;
  relatedEntityId?: string;
  [key: string]: unknown;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async registerToken(
    userId: string,
    userType: string,
    dto: RegisterDeviceTokenDto,
  ): Promise<void> {
    const existing = await this.deviceTokenRepository.findOne({
      where: { userId, expoPushToken: dto.expoPushToken },
    });

    if (existing) {
      existing.isActive = true;
      existing.platform = dto.platform ?? existing.platform;
      await this.deviceTokenRepository.save(existing);
      return;
    }

    const token = this.deviceTokenRepository.create({
      userId,
      userType,
      expoPushToken: dto.expoPushToken,
      platform: dto.platform ?? 'unknown',
      isActive: true,
    });

    await this.deviceTokenRepository.save(token);
  }

  async unregisterToken(userId: string, expoPushToken: string): Promise<void> {
    await this.deviceTokenRepository.update({ userId, expoPushToken }, { isActive: false });
  }

  async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data: PushPayload,
  ): Promise<void> {
    const tokens = await this.deviceTokenRepository.find({
      where: { userId, isActive: true },
    });

    if (!tokens.length) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.expoPushToken))
      .map((t) => ({
        to: t.expoPushToken,
        sound: 'default' as const,
        title,
        body,
        data,
      }));

    if (!messages.length) return;

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);

        for (const ticket of tickets) {
          if (ticket.status === 'error') {
            this.logger.warn(`Push error: ${ticket.message}`);

            if (
              ticket.details?.error === 'DeviceNotRegistered' ||
              ticket.details?.error === 'InvalidCredentials'
            ) {
              const tokenStr = (ticket as any).to as string | undefined;
              if (tokenStr) {
                await this.deviceTokenRepository.update(
                  { expoPushToken: tokenStr },
                  { isActive: false },
                );
              }
            }
          }
        }
      } catch (err) {
        this.logger.error(`Failed to send push chunk: ${(err as Error).message}`);
      }
    }
  }

  // ─── Persistent in-app notifications ────────────────────────────────────────

  async createNotification(
    userId: string,
    userType: string,
    title: string,
    body: string,
    type: string,
    data?: Record<string, unknown>,
    relatedEntityId?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId,
      userType,
      title,
      body,
      type,
      data: data ?? null,
      relatedEntityId: relatedEntityId ?? null,
      isRead: false,
    });
    const saved = await this.notificationRepository.save(notification);

    // Fire push (best-effort, no await needed to block the caller)
    this.sendPushToUser(userId, title, body, { type, relatedEntityId, ...data }).catch((err) =>
      this.logger.error(`Push failed: ${err.message}`),
    );

    return saved;
  }

  async syncAccessRequestNotificationStatus(
    relatedEntityId: string,
    status: AccessRequestStatus,
  ): Promise<void> {
    const notifications = await this.notificationRepository.find({
      where: {
        relatedEntityId,
        type: 'ACCESS_REQUEST_CREATED',
      },
    });

    if (!notifications.length) {
      return;
    }

    await this.notificationRepository.save(
      notifications.map((notification) => ({
        ...notification,
        data: {
          ...(notification.data ?? {}),
          status,
        },
      })),
    );
  }

  async syncAppointmentCompletionNotificationStatus(
    relatedEntityId: string,
    status: AppointmentStatus,
  ): Promise<void> {
    const notifications = await this.notificationRepository.find({
      where: {
        relatedEntityId,
        type: 'APPOINTMENT_COMPLETION_REQUESTED',
      },
    });

    if (!notifications.length) {
      return;
    }

    await this.notificationRepository.save(
      notifications.map((notification) => ({
        ...notification,
        data: {
          ...(notification.data ?? {}),
          status,
        },
      })),
    );
  }

  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getUnreadCountForUser(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException();
    notification.isRead = true;
    await this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update({ userId, isRead: false }, { isRead: true });
  }
}
