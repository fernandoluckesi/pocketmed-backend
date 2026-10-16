import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Doctor } from '../../entities/doctor.entity';
import { FinancialService } from '../financial.service';
import { FinancialFindings } from './financial-findings.types';

const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Computes "Destaques do Mês" — a fixed set of findings (same shape and same
 * deterministic logic for every clinic, every month), built from the same
 * underlying reports a clinic admin could already run one by one (receita,
 * inadimplência, glosa, produtividade, despesas por centro de custo). This is
 * plain backend aggregation, not an AI feature — every number here is exactly
 * what the corresponding /financial/reports/* endpoint would also return.
 */
@Injectable()
export class FinancialHighlightsService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    private readonly financialService: FinancialService,
  ) {}

  async getHighlights(clinicId: string, year?: number, month?: number): Promise<FinancialFindings> {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    const period = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const startDate = `${period}-01`;
    const endDate = `${period}-31`;
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const [kpis, inadimplencia, glosaReport, productivityReport, costCentersCurrent, costCentersPrev] =
      await Promise.all([
        this.financialService.getDashboardKPIs(clinicId, targetYear, targetMonth),
        this.financialService.getInadimplenciaReport(clinicId, { startDate, endDate }),
        this.financialService.getGlosaReport(clinicId, { startDate, endDate }),
        this.financialService.getProductivityReport(clinicId, { startDate, endDate }),
        this.financialService.getExpensesByCostCenterReport(clinicId, { startDate, endDate }),
        this.financialService.getExpensesByCostCenterReport(clinicId, {
          startDate: `${prevPeriod}-01`,
          endDate: `${prevPeriod}-31`,
        }),
      ]);

    const nivelInadimplencia: 'baixo' | 'medio' | 'alto' =
      kpis.inadimplencia >= 15 ? 'alto' : kpis.inadimplencia >= 5 ? 'medio' : 'baixo';

    // Convênio com maior glosa, em % da receita total do mês
    const topGlosa = [...glosaReport.byConvenio].sort((a, b) => b.totalGlosa - a.totalGlosa)[0];
    const convenioComMaisGlosa =
      topGlosa && topGlosa.totalGlosa > 0
        ? {
            nome: topGlosa.name,
            valorGlosado: topGlosa.totalGlosa,
            percentualDaReceita:
              kpis.faturamento > 0
                ? Math.round((topGlosa.totalGlosa / kpis.faturamento) * 10000) / 100
                : 0,
          }
        : null;

    // Médico mais produtivo (maior faturamento no período)
    const topDoctor = productivityReport.ranking[0];
    let medicoMaisProdutivo: FinancialFindings['medicoMaisProdutivo'] = null;
    if (topDoctor && topDoctor.doctorId !== 'unknown') {
      const doctor = await this.doctorRepo.findOne({ where: { id: topDoctor.doctorId } });
      medicoMaisProdutivo = {
        nome: doctor?.name || 'Médico não identificado',
        faturamento: topDoctor.total,
        atendimentos: topDoctor.count,
      };
    }

    // Centro de custo com maior crescimento de despesa vs. mês anterior
    const prevByName = new Map(costCentersPrev.byCostCenter.map((c) => [c.name, c.total]));
    const growthCandidates = costCentersCurrent.byCostCenter
      .map((c) => {
        const prevTotal = prevByName.get(c.name);
        if (!prevTotal || prevTotal <= 0) return null;
        return {
          nome: c.name,
          valorAtual: c.total,
          variacaoPercentual: Math.round(((c.total - prevTotal) / prevTotal) * 10000) / 100,
        };
      })
      .filter((c): c is NonNullable<typeof c> => !!c && c.variacaoPercentual > 0)
      .sort((a, b) => b.variacaoPercentual - a.variacaoPercentual);

    return {
      period: { year: targetYear, month: targetMonth, monthLabel: MONTH_LABELS[targetMonth - 1] },
      resumoFinanceiro: {
        faturamento: kpis.faturamento,
        lucro: kpis.lucro,
        crescimentoPercentual: kpis.crescimento,
      },
      riscoInadimplencia: {
        nivel: nivelInadimplencia,
        percentual: kpis.inadimplencia,
        valorVencido: inadimplencia.totalInadimplente,
      },
      convenioComMaisGlosa,
      medicoMaisProdutivo,
      centroDeCustoQueMaisCresceu: growthCandidates[0] || null,
    };
  }
}
