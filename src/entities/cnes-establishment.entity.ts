import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A local cache of real health establishments pulled from the government's
 * public CNES API (Cadastro Nacional de Estabelecimentos de Saúde). The
 * CNES API has no "search by name" filter — only by município/UF/código —
 * so a patient's free-text clinic search can't hit it live. Instead we
 * sync a município's establishments here the first time anyone searches
 * within it (see `CnesService`), and name search runs against this table.
 */
@Entity('cnes_establishments')
export class CnesEstablishment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** CNES's own establishment code — the natural key from the source. */
  @Column({ type: 'varchar', length: 20, unique: true })
  codigoCnes: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  nomeFantasia: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nomeRazaoSocial: string | null;

  @Column({ type: 'varchar', length: 18, nullable: true })
  cnpj: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  cep: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endereco: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  numero: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bairro: string | null;

  /** 6-digit DATASUS/CNES município code (IBGE's 7-digit code minus its
   * trailing check digit) — see `IbgeService.resolveMunicipio`. */
  @Index()
  @Column({ type: 'int' })
  codigoMunicipio: number;

  @Column({ type: 'int' })
  codigoUf: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number | null;

  @Column({ type: 'datetime' })
  syncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
