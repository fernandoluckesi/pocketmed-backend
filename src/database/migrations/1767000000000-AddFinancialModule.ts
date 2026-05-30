import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinancialModule1767000000000 implements MigrationInterface {
  name = 'AddFinancialModule1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Financial Settings
    await queryRunner.query(`
      CREATE TABLE \`financial_settings\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`taxRegime\` varchar(30) NOT NULL,
        \`issRate\` decimal(5,2) NOT NULL,
        \`dasRate\` decimal(5,2) NULL,
        \`irpjRate\` decimal(5,2) NULL,
        \`csllRate\` decimal(5,2) NULL,
        \`defaultDoctorTransferPercentage\` decimal(5,2) NOT NULL,
        \`bankName\` varchar(100) NULL,
        \`bankAgency\` varchar(10) NULL,
        \`bankAccount\` varchar(20) NULL,
        \`pixKey\` varchar(100) NULL,
        \`invoicePrefix\` varchar(10) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_financial_settings_clinic\` (\`clinicId\`),
        CONSTRAINT \`FK_financial_settings_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 2. Financial Cost Centers
    await queryRunner.query(`
      CREATE TABLE \`financial_cost_centers\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`code\` varchar(20) NOT NULL,
        \`budgetAllocated\` decimal(10,2) NULL,
        \`color\` varchar(7) NULL,
        \`active\` tinyint NOT NULL DEFAULT 1,
        \`description\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_financial_cost_centers_clinic\` (\`clinicId\`),
        CONSTRAINT \`FK_financial_cost_centers_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 3. Financial Convenios
    await queryRunner.query(`
      CREATE TABLE \`financial_convenios\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`ansCode\` varchar(10) NOT NULL,
        \`cnpj\` varchar(18) NULL,
        \`contractTable\` varchar(20) NOT NULL,
        \`paymentTerm\` int NOT NULL,
        \`glosaTolerance\` decimal(5,2) NOT NULL,
        \`markupPercentage\` decimal(5,2) NULL,
        \`contactName\` varchar(255) NULL,
        \`contactPhone\` varchar(20) NULL,
        \`contactEmail\` varchar(255) NULL,
        \`contractStartDate\` date NULL,
        \`contractEndDate\` date NULL,
        \`active\` tinyint NOT NULL DEFAULT 1,
        \`notes\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_financial_convenios_clinic\` (\`clinicId\`),
        CONSTRAINT \`FK_financial_convenios_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 4. Financial Revenues
    await queryRunner.query(`
      CREATE TABLE \`financial_revenues\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`patientId\` varchar(36) NULL,
        \`doctorId\` varchar(36) NULL,
        \`appointmentId\` varchar(36) NULL,
        \`convenioId\` varchar(36) NULL,
        \`procedure\` varchar(255) NOT NULL,
        \`procedureCode\` varchar(20) NULL,
        \`specialty\` varchar(100) NOT NULL,
        \`grossValue\` decimal(10,2) NOT NULL,
        \`discountValue\` decimal(10,2) NULL DEFAULT 0,
        \`netValue\` decimal(10,2) NOT NULL,
        \`paymentMethod\` varchar(30) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'PENDENTE',
        \`dueDate\` date NOT NULL,
        \`paidAt\` datetime NULL,
        \`invoiceNumber\` varchar(50) NULL,
        \`guideNumber\` varchar(50) NULL,
        \`glosaValue\` decimal(10,2) NULL,
        \`glosaReason\` text NULL,
        \`notes\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_financial_revenues_clinic\` (\`clinicId\`),
        KEY \`FK_financial_revenues_convenio\` (\`convenioId\`),
        CONSTRAINT \`FK_financial_revenues_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_financial_revenues_convenio\` FOREIGN KEY (\`convenioId\`) REFERENCES \`financial_convenios\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 5. Financial Expenses
    await queryRunner.query(`
      CREATE TABLE \`financial_expenses\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`costCenterId\` varchar(36) NOT NULL,
        \`category\` varchar(50) NOT NULL,
        \`subcategory\` varchar(100) NULL,
        \`provider\` varchar(255) NOT NULL,
        \`providerCnpj\` varchar(18) NULL,
        \`description\` text NULL,
        \`grossValue\` decimal(10,2) NOT NULL,
        \`taxValue\` decimal(10,2) NULL DEFAULT 0,
        \`netValue\` decimal(10,2) NOT NULL,
        \`paymentMethod\` varchar(30) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'PENDENTE',
        \`dueDate\` date NOT NULL,
        \`paidAt\` datetime NULL,
        \`recurrence\` varchar(20) NOT NULL DEFAULT 'UNICA',
        \`invoiceNumber\` varchar(50) NULL,
        \`attachmentUrl\` varchar(500) NULL,
        \`notes\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_financial_expenses_clinic\` (\`clinicId\`),
        KEY \`FK_financial_expenses_cost_center\` (\`costCenterId\`),
        CONSTRAINT \`FK_financial_expenses_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_financial_expenses_cost_center\` FOREIGN KEY (\`costCenterId\`) REFERENCES \`financial_cost_centers\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 6. Financial Doctor Transfers
    await queryRunner.query(`
      CREATE TABLE \`financial_doctor_transfers\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`doctorId\` varchar(36) NOT NULL,
        \`referenceMonth\` varchar(7) NOT NULL,
        \`totalRevenue\` decimal(10,2) NOT NULL,
        \`transferPercentage\` decimal(5,2) NOT NULL,
        \`transferAmount\` decimal(10,2) NOT NULL,
        \`deductions\` decimal(10,2) NULL DEFAULT 0,
        \`netTransfer\` decimal(10,2) NOT NULL,
        \`proceduresCount\` int NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'CALCULADO',
        \`paidAt\` datetime NULL,
        \`paymentProof\` varchar(500) NULL,
        \`notes\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_financial_doctor_transfers_clinic\` (\`clinicId\`),
        CONSTRAINT \`FK_financial_doctor_transfers_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 7. Financial Cashflow Entries
    await queryRunner.query(`
      CREATE TABLE \`financial_cashflow_entries\` (
        \`id\` varchar(36) NOT NULL,
        \`clinicId\` varchar(36) NOT NULL,
        \`type\` varchar(10) NOT NULL,
        \`sourceType\` varchar(20) NOT NULL,
        \`sourceId\` varchar(36) NULL,
        \`description\` varchar(255) NOT NULL,
        \`value\` decimal(10,2) NOT NULL,
        \`date\` date NOT NULL,
        \`balanceAfter\` decimal(10,2) NULL,
        \`category\` varchar(100) NULL,
        \`reconciled\` tinyint NOT NULL DEFAULT 0,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`FK_financial_cashflow_entries_clinic\` (\`clinicId\`),
        CONSTRAINT \`FK_financial_cashflow_entries_clinic\` FOREIGN KEY (\`clinicId\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`financial_cashflow_entries\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`financial_doctor_transfers\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`financial_expenses\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`financial_revenues\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`financial_convenios\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`financial_cost_centers\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`financial_settings\`;`);
  }
}
