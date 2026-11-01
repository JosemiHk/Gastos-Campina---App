import { BillingPeriod, DEFAULT_PARTICIPANTS, PaymentGroup, TransferAccount } from './models';
import { equalWeights, ruleDescription, groupTotals } from './distribution';
import { formatMoney, monthLabel } from './money';
export function summaryText(
  period: BillingPeriod,
  groups: PaymentGroup[],
  accounts: TransferAccount[],
): string {
  const calculation = period.calculation;
  if (!calculation?.receiptCount) return '';
  const lines = [`🌿 *CAMPIÑA GASTOS · ${monthLabel(period.month).toUpperCase()}*`];
  if (calculation.receiptCount < 3)
    lines.push(`*RESUMEN PARCIAL · ${calculation.receiptCount} de 3 recibos*`);
  lines.push('', '*SERVICIOS DEL HOGAR*');
  for (const service of ['water', 'electricity', 'internet'] as const) {
    const bill = period.receipts.find((r) => r.service === service && r.status === 'confirmed');
    if (bill)
      lines.push(
        `${service === 'water' ? '💧 Agua' : service === 'electricity' ? '💡 Luz' : '🌐 Internet WIN'}: ${formatMoney(bill.amountCents)}`,
      );
  }
  lines.push(`*Total del mes: ${formatMoney(calculation.totalCents)}*`, '', '*CUOTAS DEL MES*');
  const totals = groupTotals(calculation);
  for (const group of groups) {
    if (
      group.kind === 'special' &&
      !calculation.allocations.some((a) => a.groupCode === group.code)
    )
      continue;
    const name = calculation.groupNames?.[group.code] ?? group.name;
    const paid = period.payments
      .filter((p) => p.groupCode === group.code && !p.voidedAt)
      .reduce((sum, p) => sum + p.amountCents, 0);
    lines.push(
      `• *${name}: ${formatMoney(totals[group.code])}*${group.kind === 'special' ? ' (congeladora)' : ''}`,
    );
    if (paid > 0)
      lines.push(
        `  Recibido: ${formatMoney(paid)}${paid < totals[group.code] ? ` · Pendiente: ${formatMoney(totals[group.code] - paid)}` : paid > totals[group.code] ? ` · Saldo a favor: ${formatMoney(paid - totals[group.code])}` : ' · Pagado'}`,
      );
  }
  if (period.receipts.some((r) => r.service === 'electricity' && r.status === 'confirmed')) {
    const specialName =
      calculation.groupNames?.rossana ??
      groups.find((g) => g.code === 'rossana')?.name ??
      'aporte especial';
    const participants = period.participants ?? DEFAULT_PARTICIPANTS;
    const weights = calculation.ruleWeights ?? period.ruleWeights ?? equalWeights(participants);
    lines.push(
      '',
      `La luz incluye ${formatMoney(calculation.fixedContributionCents)} de ${specialName}; el saldo se divide entre ${participants.electricity.length} ${participants.electricity.length === 1 ? 'grupo' : 'grupos'}.`,
      ruleDescription(
        'electricity',
        participants,
        weights,
        (code) =>
          calculation.groupNames?.[code] ?? groups.find((g) => g.code === code)?.name ?? code,
      ),
    );
  }
  for (const service of ['water', 'internet'] as const) {
    if (period.receipts.some((r) => r.service === service && r.status === 'confirmed')) {
      const participants = period.participants ?? DEFAULT_PARTICIPANTS;
      lines.push(
        `${service === 'water' ? 'Agua' : 'Internet'}: ${ruleDescription(service, participants, calculation.ruleWeights ?? period.ruleWeights ?? equalWeights(participants), (code) => calculation.groupNames?.[code] ?? groups.find((g) => g.code === code)?.name ?? code)}.`,
      );
    }
  }
  if (calculation.roundingPolicy === 'balanced_monthly_v1')
    lines.push('Redondeo equilibrado entre servicios para grupos con la misma participación.');
  if (accounts.length) {
    lines.push('', '*DATOS PARA TRANSFERIR*');
    for (const account of accounts) {
      lines.push(`• ${account.label}: ${account.number}`, `  Titular: ${account.holder}`);
      if (account.kind === 'bank' && account.cci) lines.push(`  CCI: ${account.cci}`);
    }
  }
  lines.push('', '_Generado por Campiña Gastos · Cuentas claras en casa_');
  return lines.join('\n');
}
