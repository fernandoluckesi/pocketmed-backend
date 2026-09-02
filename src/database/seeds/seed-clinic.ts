import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';
import { Doctor } from '../../entities/doctor.entity';
import { Clinic } from '../../entities/clinic.entity';
import { ClinicMembership } from '../../entities/clinic-membership.entity';
import { ProfessionalRole } from '../../auth/professional-role.enum';

export async function seedClinic() {
  const shouldDestroyConnection = !AppDataSource.isInitialized;

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const doctorRepository = AppDataSource.getRepository(Doctor);
  const clinicRepository = AppDataSource.getRepository(Clinic);
  const membershipRepository = AppDataSource.getRepository(ClinicMembership);

  const passwordHash = await bcrypt.hash('958969', 10);

  // ── Clínica ──────────────────────────────────────────────────────────────────
  let clinic = await clinicRepository.findOne({
    where: { name: 'Clínica Hispora Seed' },
  });

  if (!clinic) {
    clinic = clinicRepository.create({
      name: 'Clínica Hispora Seed',
      cnpj: '12.345.678/0001-99',
      isActive: true,
    });
    clinic = await clinicRepository.save(clinic);
  }

  // ── Admin da clínica ─────────────────────────────────────────────────────────
  let adminDoctor = await doctorRepository.findOne({
    where: { email: 'admin.clinic@pocketmed.com' },
  });

  if (!adminDoctor) {
    adminDoctor = doctorRepository.create({
      name: 'Admin Clínica Hispora',
      email: 'admin.clinic@pocketmed.com',
      password: passwordHash,
      gender: 'male',
      phone: '11911111111',
      birthDate: new Date('1980-01-15'),
      specialty: 'Administração',
      crm: 'CRM-SP-00001',
      cpf: '11111111111',
      profileImage: null,
      type: 'doctor',
      isShadow: false,
    });
    adminDoctor = await doctorRepository.save(adminDoctor);
  }

  let adminMembership = await membershipRepository.findOne({
    where: { clinicId: clinic.id, professionalId: adminDoctor.id },
  });

  if (!adminMembership) {
    adminMembership = membershipRepository.create({
      clinicId: clinic.id,
      professionalId: adminDoctor.id,
      role: ProfessionalRole.ADMIN,
      isActive: true,
      invitedBy: null,
    });
    await membershipRepository.save(adminMembership);
  }

  // ── Médico da clínica ────────────────────────────────────────────────────────
  let clinicDoctor = await doctorRepository.findOne({
    where: { email: 'doctor.clinic@pocketmed.com' },
  });

  if (!clinicDoctor) {
    clinicDoctor = doctorRepository.create({
      name: 'Médico Clínica Hispora',
      email: 'doctor.clinic@pocketmed.com',
      password: passwordHash,
      gender: 'female',
      phone: '11922222222',
      birthDate: new Date('1985-06-20'),
      specialty: 'Clínica Geral',
      crm: 'CRM-SP-00002',
      cpf: '22222222222',
      profileImage: null,
      type: 'doctor',
      isShadow: false,
    });
    clinicDoctor = await doctorRepository.save(clinicDoctor);
  }

  let doctorMembership = await membershipRepository.findOne({
    where: { clinicId: clinic.id, professionalId: clinicDoctor.id },
  });

  if (!doctorMembership) {
    doctorMembership = membershipRepository.create({
      clinicId: clinic.id,
      professionalId: clinicDoctor.id,
      role: ProfessionalRole.DOCTOR,
      isActive: true,
      invitedBy: adminDoctor.id,
    });
    await membershipRepository.save(doctorMembership);
  }

  // ── Secretária da clínica ────────────────────────────────────────────────────
  let secretary = await doctorRepository.findOne({
    where: { email: 'secretary.clinic@pocketmed.com' },
  });

  if (!secretary) {
    secretary = doctorRepository.create({
      name: 'Secretária Clínica Hispora',
      email: 'secretary.clinic@pocketmed.com',
      password: passwordHash,
      gender: 'female',
      phone: '11933333333',
      birthDate: new Date('1992-09-10'),
      specialty: 'Secretaria',
      crm: 'SEC-00001',
      cpf: '33333333333',
      profileImage: null,
      type: 'doctor',
      isShadow: false,
    });
    secretary = await doctorRepository.save(secretary);
  }

  let secretaryMembership = await membershipRepository.findOne({
    where: { clinicId: clinic.id, professionalId: secretary.id },
  });

  if (!secretaryMembership) {
    secretaryMembership = membershipRepository.create({
      clinicId: clinic.id,
      professionalId: secretary.id,
      role: ProfessionalRole.SECRETARY,
      isActive: true,
      invitedBy: adminDoctor.id,
    });
    await membershipRepository.save(secretaryMembership);
  }

  console.log('─────────────────────────────────────────────────');
  console.log('Seed de clínica finalizada com sucesso!');
  console.log(`Clínica: ${clinic.name} (id: ${clinic.id})`);
  console.log('Admin    → admin.clinic@pocketmed.com    / 958969');
  console.log('Médico   → doctor.clinic@pocketmed.com   / 958969');
  console.log('Secretária → secretary.clinic@pocketmed.com / 958969');
  console.log('─────────────────────────────────────────────────');

  if (shouldDestroyConnection && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedClinic().catch(async (error) => {
    console.error('Erro ao executar seed de clínica:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  });
}
