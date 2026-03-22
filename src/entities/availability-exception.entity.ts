import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';

export enum AvailabilityExceptionType {
  SINGLE = 'single',
  RANGE = 'range',
}

@Entity('availability_exceptions')
export class AvailabilityException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AvailabilityExceptionType,
    default: AvailabilityExceptionType.SINGLE,
  })
  type: AvailabilityExceptionType;

  @Column({ type: 'date', nullable: true })
  date: string;

  @Column({ type: 'date', nullable: true })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string;

  @Column({ type: 'boolean', default: true })
  fullDay: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true })
  startTime: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  endTime: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor)
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
