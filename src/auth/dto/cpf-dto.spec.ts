import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterPatientDto } from './register-patient.dto';
import { RegisterDoctorDto } from './register-doctor.dto';

/**
 * Validates the CPF rules on the registration DTOs. This guarantees an invalid
 * CPF is rejected at the API boundary even if a caller bypasses the frontend.
 */

const VALID_CPF_UNMASKED = '39053344705';
const VALID_CPF_MASKED = '390.533.447-05';
const INVALID_CPF = '39053344700';

function buildValidPatient(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    name: 'Paciente Teste',
    email: 'paciente.teste@email.com',
    gender: 'Masculino',
    password: 'Senha@123',
    phone: '(11) 99999-1234',
    birthDate: '1990-01-01',
    ...overrides,
  };
}

function buildValidDoctor(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    name: 'Dr. Teste',
    email: 'dr.teste@email.com',
    password: 'Senha@123',
    gender: 'Masculino',
    specialty: 'Cardiologia',
    cpf: VALID_CPF_UNMASKED,
    phone: '(11) 99248-6811',
    birthDate: '1990-01-01',
    crm: '198850/SP',
    ...overrides,
  };
}

function cpfErrors(errors: Awaited<ReturnType<typeof validate>>) {
  return errors.filter((e) => e.property === 'cpf');
}

describe('RegisterPatientDto - CPF (optional)', () => {
  it('passes with a valid unmasked CPF', async () => {
    const dto = plainToInstance(RegisterPatientDto, buildValidPatient({ cpf: VALID_CPF_UNMASKED }));
    expect(cpfErrors(await validate(dto))).toHaveLength(0);
  });

  it('passes with a valid masked CPF', async () => {
    const dto = plainToInstance(RegisterPatientDto, buildValidPatient({ cpf: VALID_CPF_MASKED }));
    expect(cpfErrors(await validate(dto))).toHaveLength(0);
  });

  it('passes when CPF is omitted (optional at signup)', async () => {
    const dto = plainToInstance(RegisterPatientDto, buildValidPatient());
    expect(cpfErrors(await validate(dto))).toHaveLength(0);
  });

  it('fails with an invalid CPF (wrong check digits)', async () => {
    const dto = plainToInstance(RegisterPatientDto, buildValidPatient({ cpf: INVALID_CPF }));
    expect(cpfErrors(await validate(dto)).length).toBeGreaterThan(0);
  });

  it('fails with a repeated-digit CPF', async () => {
    const dto = plainToInstance(RegisterPatientDto, buildValidPatient({ cpf: '00000000000' }));
    expect(cpfErrors(await validate(dto)).length).toBeGreaterThan(0);
  });
});

describe('RegisterDoctorDto - CPF (required)', () => {
  it('passes with a valid unmasked CPF', async () => {
    const dto = plainToInstance(RegisterDoctorDto, buildValidDoctor({ cpf: VALID_CPF_UNMASKED }));
    expect(cpfErrors(await validate(dto))).toHaveLength(0);
  });

  it('passes with a valid masked CPF', async () => {
    const dto = plainToInstance(RegisterDoctorDto, buildValidDoctor({ cpf: VALID_CPF_MASKED }));
    expect(cpfErrors(await validate(dto))).toHaveLength(0);
  });

  it('fails with an invalid CPF', async () => {
    const dto = plainToInstance(RegisterDoctorDto, buildValidDoctor({ cpf: INVALID_CPF }));
    expect(cpfErrors(await validate(dto)).length).toBeGreaterThan(0);
  });

  it('fails when CPF is empty', async () => {
    const dto = plainToInstance(RegisterDoctorDto, buildValidDoctor({ cpf: '' }));
    expect(cpfErrors(await validate(dto)).length).toBeGreaterThan(0);
  });
});
