/**
 * Provisions an internal Hispora back office user.
 *
 * Back office accounts grant platform-wide access to professional data, so they
 * are created only through this script — there is no public sign-up endpoint.
 *
 * Usage:
 *   ts-node -r tsconfig-paths/register src/database/seeds/seed-backoffice-user.ts \
 *     --name "Nome" --email pessoa@hispora.com --password "senha" --role analyst
 *
 * The password can also be supplied via the BACKOFFICE_PASSWORD env var to keep
 * it out of the shell history.
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';
import { BackofficeUser, BackofficeRole } from '../../entities/backoffice-user.entity';

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function run() {
  const name = getArg('--name');
  const email = getArg('--email')?.trim().toLowerCase();
  const password = getArg('--password') || process.env.BACKOFFICE_PASSWORD;
  const role = (getArg('--role') || BackofficeRole.ANALYST) as BackofficeRole;

  if (!name || !email || !password) {
    throw new Error(
      'Missing required args: --name, --email and --password (or BACKOFFICE_PASSWORD)',
    );
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (!Object.values(BackofficeRole).includes(role)) {
    throw new Error(`Invalid --role. Use one of: ${Object.values(BackofficeRole).join(', ')}`);
  }

  await AppDataSource.initialize();

  // Print the target so nobody seeds the wrong environment by accident.
  const options = AppDataSource.options as { host?: string; database?: string };
  console.log(`Banco: ${options.host || '(url)'} / ${options.database || '(url)'}`);

  const repository = AppDataSource.getRepository(BackofficeUser);

  const existing = await repository.findOne({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    existing.name = name;
    existing.password = passwordHash;
    existing.backofficeRole = role;
    existing.isActive = true;
    await repository.save(existing);
    console.log(`Usuario de backoffice ATUALIZADO: ${email} (${role})`);
  } else {
    const created = repository.create({
      name,
      email,
      password: passwordHash,
      backofficeRole: role,
      isActive: true,
    });
    await repository.save(created);
    console.log(`Usuario de backoffice CRIADO: ${email} (${role})`);
  }

  // Confirms the stored hash matches the password provided, so a shell-quoting
  // mistake surfaces here instead of as a confusing 401 at login.
  const saved = await repository.findOne({ where: { email } });
  const matches = saved ? await bcrypt.compare(password, saved.password) : false;
  console.log(`Verificacao da senha: ${matches ? 'OK' : 'FALHOU'}`);
  console.log(`Tamanho da senha recebida: ${password.length} caracteres`);

  await AppDataSource.destroy();
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
