/**
 * The "destaques do mês" (monthly highlights) bundle: a fixed structure,
 * computed deterministically by the backend, identical in shape for every
 * clinic every month — the same reports (receita, inadimplência, glosa,
 * produtividade, centro de custo) a human financial analyst would already
 * check, just pre-aggregated into the single most relevant fact per topic.
 */
export interface FinancialFindings {
  period: { year: number; month: number; monthLabel: string };
  resumoFinanceiro: {
    faturamento: number;
    lucro: number;
    crescimentoPercentual: number; // vs. previous month
  };
  riscoInadimplencia: {
    nivel: 'baixo' | 'medio' | 'alto';
    percentual: number;
    valorVencido: number;
  };
  convenioComMaisGlosa: {
    nome: string;
    valorGlosado: number;
    percentualDaReceita: number;
  } | null;
  medicoMaisProdutivo: {
    nome: string;
    faturamento: number;
    atendimentos: number;
  } | null;
  centroDeCustoQueMaisCresceu: {
    nome: string;
    valorAtual: number;
    variacaoPercentual: number; // vs. previous month
  } | null;
}
