export type ServiceCode = 'water' | 'electricity' | 'internet';
export type GroupCode = 'twins' | 'miguel' | 'jm' | 'rossana';
export type RegularGroupCode = Exclude<GroupCode, 'rossana'>;
export type RuleParticipants = Record<ServiceCode, readonly RegularGroupCode[]>;
export const DEFAULT_PARTICIPANTS: RuleParticipants = {
  water: ['twins', 'miguel', 'jm'],
  electricity: ['twins', 'miguel', 'jm'],
  internet: ['miguel', 'jm'],
};
export interface EditablePaymentGroup {
  code: GroupCode;
  name: string;
  members: string[];
}
export type Role = 'admin' | 'member' | 'viewer';
export interface HouseholdAccess {
  userId: string;
  name: string;
  email: string;
  role: Role;
  canReview: boolean;
  active: boolean;
  revision: number;
}
export interface HouseholdInvitation {
  id: string;
  name: string;
  email: string;
  role: Role;
  canReview: boolean;
  createdAt: string;
}
export interface ReceiptCorrection {
  kind?: 'request' | 'direct';
  resolvedName?: string;
  id: string;
  month: string;
  receiptId: string;
  before: ReceiptInput;
  proposed: ReceiptInput;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'stale';
  requestedBy: string;
  requestedName: string;
  requestedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
}
export type ReceiptStatus = 'draft' | 'confirmed';
export interface PaymentGroup {
  id: string;
  code: GroupCode;
  name: string;
  members: string[];
  kind: 'regular' | 'special';
  sortOrder: number;
}
export interface Receipt {
  revision?: number;
  createdBy?: string;
  id: string;
  service: ServiceCode;
  amountCents: number;
  dueDate: string | null;
  issueDate: string | null;
  status: ReceiptStatus;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  createdAt: string;
}
export interface Allocation {
  groupCode: GroupCode;
  service: ServiceCode;
  amountCents: number;
  remainderCents: number;
}
export interface Calculation {
  id?: string;
  totalCents: number;
  receiptCount: number;
  fixedContributionCents: number;
  allocations: Allocation[];
  groupNames?: Partial<Record<GroupCode, string>>;
  groupMembers?: Partial<Record<GroupCode, string[]>>;
  createdAt?: string;
}
export interface PaymentConfirmation {
  id: string;
  groupCode: GroupCode;
  amountCents: number;
  method: string;
  confirmedAt: string;
  voidedAt: string | null;
}
export interface ActivityEvent {
  id: string;
  description: string;
  createdAt: string;
}
export interface TransferAccount {
  id: string;
  kind: 'yape' | 'plin' | 'bank';
  label: string;
  holder: string;
  number: string;
  cci: string;
}
export interface BillingPeriod {
  participants?: RuleParticipants;
  id: string;
  month: string;
  status: 'open' | 'closed';
  revision: number;
  fixedContributionCents: number;
  receipts: Receipt[];
  calculation: Calculation | null;
  payments: PaymentConfirmation[];
  activity: ActivityEvent[];
  closedAt: string | null;
}
export interface HouseholdData {
  accessEnabled?: boolean;
  canReview?: boolean;
  currentUserId?: string;
  myName?: string;
  corrections?: ReceiptCorrection[];
  household: {
    id: string;
    name: string;
    fixedContributionCents: number;
    configurationRevision?: number;
    participants?: RuleParticipants;
  };
  role: Role;
  groups: PaymentGroup[];
  periods: BillingPeriod[];
  accounts: TransferAccount[];
}
export interface ReceiptInput {
  id: string;
  service: ServiceCode;
  amountCents: number;
  dueDate: string | null;
  issueDate: string | null;
  status: ReceiptStatus;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
}
export const SERVICES: ReadonlyArray<{
  code: ServiceCode;
  name: string;
  provider: string;
  icon: string;
}> = [
  { code: 'water', name: 'Agua', provider: 'Agua potable', icon: 'water' },
  {
    code: 'electricity',
    name: 'Luz',
    provider: 'Energía eléctrica',
    icon: 'bolt',
  },
  {
    code: 'internet',
    name: 'Internet',
    provider: 'WIN',
    icon: 'wifi',
  },
];
export const GROUP_ORDER: readonly GroupCode[] = ['twins', 'miguel', 'jm', 'rossana'];
