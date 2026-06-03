import 'reflect-metadata';
import AppDataSource from '../data-source';
import { Patient } from '../../entities/patient.entity';
import { Doctor } from '../../entities/doctor.entity';
import { DoctorPermission } from '../../entities/doctor-permission.entity';

const PATIENT_DATA = [
  { name: 'Helena S. Ferreira', email: 'helena.ferreira@email.com', phone: '11987654321', gender: 'Feminino', birthDate: '1985-05-12' },
  { name: 'Roberto Alcântara', email: 'roberto.alcantara@email.com', phone: '11976543210', gender: 'Masculino', birthDate: '1972-11-04' },
  { name: 'Lucas Mendes', email: 'lucas.mendes@email.com', phone: '11965432109', gender: 'Masculino', birthDate: '1995-03-22' },
  { name: 'Glória Maria Brandão', email: 'gloria.brandao@email.com', phone: '21988112099', gender: 'Feminino', birthDate: '1963-10-28' },
  { name: 'Enzo Rodrigues Souza', email: 'enzo.souza@email.com', phone: '11977112041', gender: 'Masculino', birthDate: '2011-02-03' },
  { name: 'Ana Clara Oliveira', email: 'ana.oliveira@email.com', phone: '11955443322', gender: 'Feminino', birthDate: '1990-07-15' },
  { name: 'Carlos Eduardo Lima', email: 'carlos.lima@email.com', phone: '11944332211', gender: 'Masculino', birthDate: '1978-01-30' },
  { name: 'Maria Heloísa Silva', email: 'maria.silva@email.com', phone: '11933221100', gender: 'Feminino', birthDate: '1988-09-18' },
  { name: 'Paulo Henrique Costa', email: 'paulo.costa@email.com', phone: '11922110099', gender: 'Masculino', birthDate: '1965-12-05' },
  { name: 'Beatriz Mendes', email: 'beatriz.mendes@email.com', phone: '11911009988', gender: 'Feminino', birthDate: '1993-04-11' },
  { name: 'Fernando Alves Neto', email: 'fernando.neto@email.com', phone: '21999887766', gender: 'Masculino', birthDate: '1982-08-25' },
  { name: 'Juliana Drummond', email: 'juliana.drummond@email.com', phone: '21988776655', gender: 'Feminino', birthDate: '1975-06-14' },
  { name: 'Ricardo Santos Filho', email: 'ricardo.santos@email.com', phone: '31977665544', gender: 'Masculino', birthDate: '1960-11-20' },
  { name: 'Camila Ferraz', email: 'camila.ferraz@email.com', phone: '31966554433', gender: 'Feminino', birthDate: '1998-02-28' },
  { name: 'Marcos Teodoro', email: 'marcos.teodoro@email.com', phone: '11955443300', gender: 'Masculino', birthDate: '1987-10-09' },
  { name: 'Larissa Borges', email: 'larissa.borges@email.com', phone: '11944332200', gender: 'Feminino', birthDate: '1992-05-17' },
  { name: 'Thiago Nascimento', email: 'thiago.nascimento@email.com', phone: '21933221199', gender: 'Masculino', birthDate: '1980-03-03' },
  { name: 'Patrícia Gomes', email: 'patricia.gomes@email.com', phone: '21922110088', gender: 'Feminino', birthDate: '1970-08-22' },
  { name: 'Diego Monteiro', email: 'diego.monteiro@email.com', phone: '31911009977', gender: 'Masculino', birthDate: '1995-12-30' },
  { name: 'Isabela Carvalho', email: 'isabela.carvalho@email.com', phone: '31900998866', gender: 'Feminino', birthDate: '1983-07-07' },
  { name: 'Guilherme Fonseca', email: 'guilherme.fonseca@email.com', phone: '11899887755', gender: 'Masculino', birthDate: '1968-09-15' },
  { name: 'Fernanda Lima', email: 'fernanda.lima@email.com', phone: '11888776644', gender: 'Feminino', birthDate: '1991-01-25' },
  { name: 'André Souza', email: 'andre.souza@email.com', phone: '21877665533', gender: 'Masculino', birthDate: '1976-04-12' },
  { name: 'Renata Pires', email: 'renata.pires@email.com', phone: '21866554422', gender: 'Feminino', birthDate: '1989-11-08' },
  { name: 'Felipe Barbosa', email: 'felipe.barbosa@email.com', phone: '31855443311', gender: 'Masculino', birthDate: '1997-06-20' },
  { name: 'Daniela Moura', email: 'daniela.moura@email.com', phone: '31844332200', gender: 'Feminino', birthDate: '1974-02-14' },
  { name: 'Rodrigo Pereira', email: 'rodrigo.pereira@email.com', phone: '11833221199', gender: 'Masculino', birthDate: '1985-08-31' },
  { name: 'Aline Castro', email: 'aline.castro@email.com', phone: '11822110088', gender: 'Feminino', birthDate: '1994-10-03' },
  { name: 'Vinícius Ramos', email: 'vinicius.ramos@email.com', phone: '21811009977', gender: 'Masculino', birthDate: '1979-05-19' },
  { name: 'Mariana Costa Ribeiro', email: 'mariana.ribeiro@email.com', phone: '21800998866', gender: 'Feminino', birthDate: '1986-12-12' },
];

async function seedPatients() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const patientRepo = AppDataSource.getRepository(Patient);
  const doctorRepo = AppDataSource.getRepository(Doctor);
  const permissionRepo = AppDataSource.getRepository(DoctorPermission);

  // Find the doctor
  const doctor = await doctorRepo.findOne({
    where: { email: 'fernando.luckesi.dr@gmail.com' },
  });

  if (!doctor) {
    console.error('❌ Doctor fernando.luckesi.dr@gmail.com not found! Create the account first.');
    await AppDataSource.destroy();
    process.exit(1);
  }

  console.log(`✅ Found doctor: ${doctor.name} (${doctor.id})`);

  const createdPatients: Patient[] = [];

  for (const data of PATIENT_DATA) {
    // Check if patient already exists
    let patient = await patientRepo.findOne({ where: { email: data.email } });

    if (!patient) {
      patient = patientRepo.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        gender: data.gender,
        birthDate: new Date(data.birthDate),
        type: 'patient',
        isShadow: true,
        doctorCreatorId: doctor.id,
      });
      patient = await patientRepo.save(patient);
      console.log(`  Created patient: ${patient.name}`);
    } else {
      console.log(`  Patient already exists: ${patient.name}`);
    }

    createdPatients.push(patient);
  }

  // Grant access to the first 15 patients
  const patientsToGrant = createdPatients.slice(0, 15);
  let grantedCount = 0;

  for (const patient of patientsToGrant) {
    const existingPermission = await permissionRepo.findOne({
      where: { doctorId: doctor.id, patientId: patient.id },
    });

    if (!existingPermission) {
      const permission = permissionRepo.create({
        doctorId: doctor.id,
        patientId: patient.id,
        isActive: true,
      });
      await permissionRepo.save(permission);
      grantedCount++;
    }
  }

  console.log(`\n✅ Seed complete:`);
  console.log(`   - ${createdPatients.length} patients total`);
  console.log(`   - ${grantedCount} new permissions granted (15 total with access)`);
  console.log(`   - 15 patients WITHOUT access (for search/request flow)`);

  await AppDataSource.destroy();
}

seedPatients().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
