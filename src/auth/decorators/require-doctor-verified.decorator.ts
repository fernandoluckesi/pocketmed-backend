import { SetMetadata } from '@nestjs/common';

export const RequireDoctorVerified = () => SetMetadata('requireDoctorVerified', true);
