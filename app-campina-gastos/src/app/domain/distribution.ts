import {
  Allocation,
  Calculation,
  DEFAULT_PARTICIPANTS,
  GroupCode,
  GROUP_ORDER,
  Receipt,
  RuleParticipants,
  RuleWeights,
} from './models';
import { MAX_RECEIPT_CENTS } from './money';

export function splitEqual(
  cents: number,
  participants: readonly GroupCode[],
): { groupCode: GroupCode; amountCents: number; remainderCents: number }[] {
  return splitWeighted(
    cents,
    participants.map((groupCode) => ({ groupCode, weight: 1 })),
  );
}

/** Largest remainder, with stable group order to break ties. All arithmetic is in cents. */
export function splitWeighted(
  cents: number,
  participants: readonly { groupCode: GroupCode; weight: number }[],
): { groupCode: GroupCode; amountCents: number; remainderCents: number }[] {
  if (
    !Number.isSafeInteger(cents) ||
    cents < 0 ||
    cents > MAX_RECEIPT_CENTS ||
    !participants.length ||
    new Set(participants.map((p) => p.groupCode)).size !== participants.length ||
    participants.some(
      (p) =>
        !GROUP_ORDER.includes(p.groupCode) ||
        !Number.isInteger(p.weight) ||
        p.weight < 1 ||
        p.weight > 10,
    )
  )
    throw new Error('Reparto inv�lido.');
  const ordered = [...participants].sort(
    (a, b) => GROUP_ORDER.indexOf(a.groupCode) - GROUP_ORDER.indexOf(b.groupCode),
  );
  const totalWeight = ordered.reduce((sum, p) => sum + p.weight, 0);
  const parts = ordered.map((p) => ({
    groupCode: p.groupCode,
    amountCents: Math.floor((cents * p.weight) / totalWeight),
    remainderCents: 0,
    fraction: (cents * p.weight) % totalWeight,
  }));
  const remaining = cents - parts.reduce((sum, p) => sum + p.amountCents, 0);
  [...parts]
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, remaining)
    .forEach((p) => {
      p.amountCents++;
      p.remainderCents = 1;
    });
  return parts.map(({ groupCode, amountCents, remainderCents }) => ({
    groupCode,
    amountCents,
    remainderCents,
  }));
}

export function calculateDistribution(
  receipts: Pick<Receipt, 'service' | 'amountCents' | 'status'>[],
  fixedContributionCents: number,
  participantsByService: RuleParticipants = DEFAULT_PARTICIPANTS,
  weightsByService?: RuleWeights,
): Calculation {
  if (
    !Number.isSafeInteger(fixedContributionCents) ||
    fixedContributionCents < 0 ||
    fixedContributionCents > MAX_RECEIPT_CENTS
  )
    throw new Error('El aporte fijo no es válido.');
  const confirmed = receipts.filter((receipt) => receipt.status === 'confirmed');
  if (new Set(confirmed.map((r) => r.service)).size !== confirmed.length)
    throw new Error('Solo puede haber un recibo por servicio y mes.');
  const allocations: Allocation[] = [];
  let totalCents = 0;
  for (const receipt of confirmed) {
    if (
      !Number.isSafeInteger(receipt.amountCents) ||
      receipt.amountCents <= 0 ||
      receipt.amountCents > MAX_RECEIPT_CENTS
    )
      throw new Error('El importe del recibo no es válido.');
    if (!['water', 'electricity', 'internet'].includes(receipt.service))
      throw new Error('Servicio no válido.');
    totalCents += receipt.amountCents;
    let distributable = receipt.amountCents;
    if (receipt.service === 'electricity') {
      if (receipt.amountCents < fixedContributionCents)
        throw new Error('El recibo de luz debe cubrir el aporte fijo especial.');
      allocations.push({
        service: 'electricity',
        groupCode: 'rossana',
        amountCents: fixedContributionCents,
        remainderCents: 0,
      });
      distributable -= fixedContributionCents;
    }
    const configured = participantsByService[receipt.service];
    if (
      !Array.isArray(configured) ||
      configured.length === 0 ||
      configured.some((code) => !['twins', 'miguel', 'jm'].includes(code)) ||
      new Set(configured).size !== configured.length
    )
      throw new Error('Selecciona grupos participantes válidos para cada servicio.');
    // Match PostgreSQL's stable group order, independently of checkbox selection order.
    const participants = GROUP_ORDER.filter((code) =>
      configured.some((participant) => participant === code),
    );
    allocations.push(
      ...splitWeighted(
        distributable,
        participants.map((groupCode) => ({
          groupCode,
          weight: weightsByService
            ? (weightsByService[receipt.service]?.[groupCode as Exclude<GroupCode, 'rossana'>] ??
              NaN)
            : 1,
        })),
      ).map((part) => ({
        ...part,
        service: receipt.service,
      })),
    );
  }
  if (allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0) !== totalCents)
    throw new Error('La distribución no coincide con los recibos.');
  return { totalCents, receiptCount: confirmed.length, fixedContributionCents, allocations };
}
export function groupTotals(calculation: Calculation | null): Record<GroupCode, number> {
  return Object.fromEntries(
    GROUP_ORDER.map((code) => [
      code,
      calculation?.allocations
        .filter((a) => a.groupCode === code)
        .reduce((sum, a) => sum + a.amountCents, 0) ?? 0,
    ]),
  ) as Record<GroupCode, number>;
}
