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
  const repository = AppDataSource.getRepository(BackofficeUser);

  const existing = await repository.findOne({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    existing.name = name;
    existing.password = passwordHash;
    existing.backofficeRole = role;
    existing.isActive = true;
    await repository.save(existing);
    console.log(`Updated back office user ${email} (${role})`);
  } else {
    const created = repository.create({
      name,
      email,
      password: passwordHash,
      backofficeRole: role,
      isActive: true,
    });
    await repository.save(created);
    console.log(`Created back office user ${email} (${role})`);
  }

  await AppDataSource.destroy();
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
