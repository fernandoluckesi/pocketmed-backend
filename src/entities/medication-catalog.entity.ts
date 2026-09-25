import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Medicamentos registrados na ANVISA, importados da lista oficial de preços
 * (CMED). Uma linha por apresentação comercial (não por princípio ativo).
 *
 * `substance` é TEXT (não varchar): associações de vacinas multivalentes
 * (ex.: pneumocócicas) listam dezenas de sorotipos e passam de 1400 caracteres.
 */
@Entity('medication_catalog')
export class MedicationCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  substance: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  product: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  presentation: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  manufacturer: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  registrationNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  therapeuticClass: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  productType: string;

  @CreateDateColumn()
  createdAt: Date;
}
