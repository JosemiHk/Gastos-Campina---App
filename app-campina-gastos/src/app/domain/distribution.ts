import { Allocation, Calculation, GroupCode, GROUP_ORDER, Receipt } from './models';
import { MAX_RECEIPT_CENTS } from './money';

export function splitEqual(cents: number, participants: readonly GroupCode[]): { groupCode: GroupCode; amountCents: number; remainderCents: number }[] {
  if (!Number.isSafeInteger(cents) || cents < 0 || participants.length === 0 || new Set(participants).size !== participants.length) throw new Error('Reparto inválido.');
  const base = Math.floor(cents / participants.length);
  const remainder = cents % participants.length;
  return participants.map((groupCode, index) => ({ groupCode, amountCents: base + (index < remainder ? 1 : 0), remainderCents: index < remainder ? 1 : 0 }));
}

export function calculateDistribution(receipts: Pick<Receipt, 'service' | 'amountCents' | 'status'>[], fixedContributionCents: number): Calculation {
  if (!Number.isSafeInteger(fixedContributionCents) || fixedContributionCents < 0 || fixedContributionCents > MAX_RECEIPT_CENTS) throw new Error('El aporte fijo no es válido.');
  const confirmed = receipts.filter(receipt => receipt.status === 'confirmed');
  if (new Set(confirmed.map(r => r.service)).size !== confirmed.length) throw new Error('Solo puede haber un recibo por servicio y mes.');
  const allocations: Allocation[] = [];
  let totalCents = 0;
  for (const receipt of confirmed) {
    if (!Number.isSafeInteger(receipt.amountCents) || receipt.amountCents <= 0 || receipt.amountCents > MAX_RECEIPT_CENTS) throw new Error('El importe del recibo no es válido.');
    if (!['water', 'electricity', 'internet'].includes(receipt.service)) throw new Error('Servicio no válido.');
    totalCents += receipt.amountCents;
    let distributable = receipt.amountCents;
    if (receipt.service === 'electricity') {
      if (receipt.amountCents < fixedContributionCents) throw new Error('El recibo de luz debe cubrir el aporte fijo de Rossana.');
      allocations.push({ service: 'electricity', groupCode: 'rossana', amountCents: fixedContributionCents, remainderCents: 0 });
      distributable -= fixedContributionCents;
    }
    const participants: readonly GroupCode[] = receipt.service === 'internet' ? ['miguel', 'jm'] : ['twins', 'miguel', 'jm'];
    allocations.push(...splitEqual(distributable, participants).map(part => ({ ...part, service: receipt.service })));
  }
  if (allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0) !== totalCents) throw new Error('La distribución no coincide con los recibos.');
  return { totalCents, receiptCount: confirmed.length, fixedContributionCents, allocations };
}
export function groupTotals(calculation: Calculation | null): Record<GroupCode, number> {
  return Object.fromEntries(GROUP_ORDER.map(code => [code, calculation?.allocations.filter(a => a.groupCode === code).reduce((sum, a) => sum + a.amountCents, 0) ?? 0])) as Record<GroupCode, number>;
}
