import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditEventsTable1787202300000 implements MigrationInterface {
  name = 'CreateAuditEventsTable1787202300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`audit_events\` (
        \`id\` varchar(36) NOT NULL,
        \`tenantId\` varchar(36) NULL,
        \`actorUserId\` varchar(36) NULL,
        \`actorRole\` varchar(50) NULL,
        \`action\` varchar(50) NOT NULL,
        \`resourceType\` varchar(100) NOT NULL,
        \`resourceId\` varchar(36) NULL,
        \`patientId\` varchar(36) NULL,
        \`success\` tinyint(1) NOT NULL,
        \`reason\` varchar(255) NULL,
        \`timestamp\` datetime(6) NOT NULL,
        \`ipAddress\` varchar(45) NULL,
        \`userAgent\` text NULL,
        \`sessionId\` varchar(36) NULL,
        \`requestId\` varchar(36) NULL,
        \`correlationId\` varchar(36) NULL,
        \`changedFields\` json NULL,
        \`metadata\` json NULL,
        \`previousHash\` varchar(64) NULL,
        \`eventHash\` varchar(64) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`CREATE INDEX \`IDX_audit_patient_timestamp\` ON \`audit_events\` (\`patientId\`, \`timestamp\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_actor_timestamp\` ON \`audit_events\` (\`actorUserId\`, \`timestamp\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_resource\` ON \`audit_events\` (\`resourceType\`, \`resourceId\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_tenant_timestamp\` ON \`audit_events\` (\`tenantId\`, \`timestamp\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_action_timestamp\` ON \`audit_events\` (\`action\`, \`timestamp\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_request_id\` ON \`audit_events\` (\`requestId\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_correlation_id\` ON \`audit_events\` (\`correlationId\`)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_audit_correlation_id\` ON \`audit_events\``);
    await queryRunner.query(`DROP INDEX \`IDX_audit_request_id\` ON \`audit_events\``);
    await queryRunner.query(`DROP INDEX \`IDX_audit_action_timestamp\` ON \`audit_events\``);
    await queryRunner.query(`DROP INDEX \`IDX_audit_tenant_timestamp\` ON \`audit_events\``);
    await queryRunner.query(`DROP INDEX \`IDX_audit_resource\` ON \`audit_events\``);
    await queryRunner.query(`DROP INDEX \`IDX_audit_actor_timestamp\` ON \`audit_events\``);
    await queryRunner.query(`DROP INDEX \`IDX_audit_patient_timestamp\` ON \`audit_events\``);
    await queryRunner.query(`DROP TABLE \`audit_events\``);
  }
}
