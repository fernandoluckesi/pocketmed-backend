import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforces CPF uniqueness among REAL patients at the database level, as a
 * safety net behind the application-level check (which can still race under
 * concurrent signups).
 *
 * MySQL has no partial/filtered unique index, so we add a STORED generated
 * column `cpfUnique` that mirrors `cpf` ONLY for real patients with a CPF, and
 * is NULL otherwise (shadow accounts and patients without a CPF). A UNIQUE
 * index on it blocks two real patients from sharing a CPF while still allowing:
 *  - many shadow patients with the same CPF (shadow/merge model), and
 *  - many patients with NULL CPF (MySQL allows multiple NULLs in a UNIQUE idx).
 *
 * Before adding the index we null out any pre-existing duplicate so the ALTER
 * can't fail on legacy data: the oldest real patient per CPF keeps it, newer
 * duplicates have their `cpf` cleared (they can re-enter it, which will then
 * hit the normal "CPF já cadastrado" validation).
 */
export class AddUniquePatientCpf1828000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Clear duplicate CPFs on real patients, keeping the earliest-created
    //    row for each CPF. Uses a self-join (works on MySQL 5.7+).
    await queryRunner.query(`
      UPDATE patients p
      JOIN (
        SELECT cpf, MIN(createdAt) AS keepCreatedAt
        FROM patients
        WHERE isShadow = 0 AND cpf IS NOT NULL AND cpf <> ''
        GROUP BY cpf
        HAVING COUNT(*) > 1
      ) dups ON p.cpf = dups.cpf
      SET p.cpf = NULL
      WHERE p.isShadow = 0
        AND p.cpf IS NOT NULL
        AND p.createdAt <> dups.keepCreatedAt
    `);

    // 2) Generated column: the CPF for real patients that have one, else NULL.
    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN cpfUnique VARCHAR(11)
        GENERATED ALWAYS AS (
          CASE WHEN isShadow = 0 AND cpf <> '' THEN cpf ELSE NULL END
        ) STORED
    `);

    // 3) Unique index on the generated column (multiple NULLs allowed).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IDX_patients_cpf_unique ON patients (cpfUnique)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IDX_patients_cpf_unique ON patients`);
    await queryRunner.query(`ALTER TABLE patients DROP COLUMN cpfUnique`);
  }
}
