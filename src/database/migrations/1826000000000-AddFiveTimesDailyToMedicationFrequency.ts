import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `five_times_daily` option to the medications.frequency enum so the
 * web (doctor) and mobile (patient) forms can offer "5x ao dia" consistently.
 *
 * All previously-existing enum values are preserved (including the legacy
 * every_6/8/12_hours entries) so no existing medication row becomes invalid —
 * the new value is simply appended.
 */
export class AddFiveTimesDailyToMedicationFrequency1826000000000
  implements MigrationInterface
{
  private static readonly ENUM_WITH_FIVE =
    "enum('once_daily','twice_daily','three_times_daily','four_times_daily','five_times_daily','every_6_hours','every_8_hours','every_12_hours','as_needed')";

  private static readonly ENUM_WITHOUT_FIVE =
    "enum('once_daily','twice_daily','three_times_daily','four_times_daily','every_6_hours','every_8_hours','every_12_hours','as_needed')";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`medications\` MODIFY \`frequency\` ${AddFiveTimesDailyToMedicationFrequency1826000000000.ENUM_WITH_FIVE} NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to the previous enum. Rows using 'five_times_daily' would become
    // invalid, so normalize them to the nearest kept value first.
    await queryRunner.query(
      `UPDATE \`medications\` SET \`frequency\` = 'four_times_daily' WHERE \`frequency\` = 'five_times_daily';`,
    );
    await queryRunner.query(
      `ALTER TABLE \`medications\` MODIFY \`frequency\` ${AddFiveTimesDailyToMedicationFrequency1826000000000.ENUM_WITHOUT_FIVE} NOT NULL;`,
    );
  }
}
