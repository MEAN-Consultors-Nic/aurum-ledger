export type PlaceholderSpec = {
  path: string;
  description: string;
  example?: string;
};

export type EventDefinition = {
  key: string;
  label: string;
  description: string;
  category: 'contract' | 'payment' | 'project' | 'income' | 'expense' | 'budget' | 'estimate' | 'misc';
  placeholders: PlaceholderSpec[];
  defaultRecipients: string[];
  // Suggested condition shape for the UI to render hints
  conditions?: { key: string; label: string; type: 'number' | 'string' | 'boolean' }[];
};

const baseClientPlaceholders: PlaceholderSpec[] = [
  { path: 'client.name', description: 'Client name', example: 'Acme Corp' },
  { path: 'client.email', description: 'Client email', example: 'admin@acme.com' },
];

const baseContractPlaceholders: PlaceholderSpec[] = [
  { path: 'contract.title', description: 'Contract title', example: 'Web Hosting' },
  { path: 'contract.amount', description: 'Contract amount', example: '120.00' },
  { path: 'contract.currency', description: 'Currency', example: 'USD' },
  { path: 'contract.startDate', description: 'Start date' },
  { path: 'contract.endDate', description: 'End date' },
  { path: 'contract.billingPeriod', description: 'monthly / annual / one_time' },
];

export const EVENT_CATALOG: EventDefinition[] = [
  {
    key: 'contract.expiring_soon',
    label: 'Contract expiring soon',
    description: 'A contract endDate is approaching within the configured window.',
    category: 'contract',
    placeholders: [
      ...baseClientPlaceholders,
      ...baseContractPlaceholders,
      { path: 'daysUntilExpiry', description: 'Days until contract endDate', example: '30' },
      { path: 'service.name', description: 'Service name', example: 'Web Hosting' },
    ],
    defaultRecipients: ['project.assignedTo'],
    conditions: [
      { key: 'daysBeforeDue', label: 'Days before due', type: 'number' },
      { key: 'minAmount', label: 'Minimum amount (USD)', type: 'number' },
    ],
  },
  {
    key: 'contract.expired',
    label: 'Contract expired',
    description: 'A contract endDate has passed and balance might still be open.',
    category: 'contract',
    placeholders: [
      ...baseClientPlaceholders,
      ...baseContractPlaceholders,
      { path: 'daysOverdue', description: 'Days since endDate' },
    ],
    defaultRecipients: ['project.assignedTo'],
  },
  {
    key: 'contract.payment_reminder',
    label: 'Payment reminder (manual)',
    description: 'Friendly reminder to the client about a pending balance — sent on demand.',
    category: 'contract',
    placeholders: [
      ...baseClientPlaceholders,
      ...baseContractPlaceholders,
      { path: 'balance', description: 'Outstanding balance', example: '120.00' },
      { path: 'daysOverdue', description: 'Days overdue (if past endDate)' },
      { path: 'service.name', description: 'Service name' },
    ],
    defaultRecipients: ['contract.client'],
  },
  {
    key: 'contract.suspension_notice',
    label: 'Suspension notice (manual)',
    description: 'Warning to the client that service will be suspended if balance is not paid.',
    category: 'contract',
    placeholders: [
      ...baseClientPlaceholders,
      ...baseContractPlaceholders,
      { path: 'balance', description: 'Outstanding balance' },
      { path: 'daysOverdue', description: 'Days overdue' },
      { path: 'service.name', description: 'Service name' },
    ],
    defaultRecipients: ['contract.client'],
  },
  {
    key: 'payment.overdue',
    label: 'Payment overdue',
    description: 'Contract has unpaid balance past its endDate.',
    category: 'payment',
    placeholders: [
      ...baseClientPlaceholders,
      ...baseContractPlaceholders,
      { path: 'balance', description: 'Outstanding balance', example: '120.00' },
      { path: 'daysOverdue', description: 'Days overdue' },
    ],
    defaultRecipients: ['project.assignedTo'],
  },
  {
    key: 'project.due_soon',
    label: 'Project due soon',
    description: 'A project dueDate is approaching.',
    category: 'project',
    placeholders: [
      { path: 'project.name', description: 'Project name' },
      { path: 'project.dueDate', description: 'Project due date' },
      { path: 'daysUntilDue', description: 'Days until due' },
      ...baseClientPlaceholders,
    ],
    defaultRecipients: ['project.assignedTo'],
    conditions: [{ key: 'daysBeforeDue', label: 'Days before due', type: 'number' }],
  },
  {
    key: 'project.task_overdue',
    label: 'Project task overdue',
    description: 'A task inside an active project is past its due date.',
    category: 'project',
    placeholders: [
      { path: 'task.title', description: 'Task title' },
      { path: 'task.dueDate', description: 'Task due date' },
      { path: 'task.priority', description: 'Priority' },
      { path: 'daysOverdue', description: 'Days overdue' },
      { path: 'project.name', description: 'Project name' },
      ...baseClientPlaceholders,
    ],
    defaultRecipients: ['project.assignedTo'],
  },
  {
    key: 'planned_income.overdue',
    label: 'Planned income overdue',
    description: 'A planned income occurrence is past its planned date and not confirmed.',
    category: 'income',
    placeholders: [
      { path: 'plannedIncome.name', description: 'Planned income name' },
      { path: 'amount', description: 'Expected amount' },
      { path: 'currency', description: 'Currency' },
      { path: 'date', description: 'Original planned date' },
      { path: 'daysOverdue', description: 'Days overdue' },
    ],
    defaultRecipients: ['admin'],
  },
  {
    key: 'recurring_expense.due',
    label: 'Recurring expense due',
    description: 'A recurring expense occurrence is due (still planned).',
    category: 'expense',
    placeholders: [
      { path: 'expense.name', description: 'Expense name' },
      { path: 'amount', description: 'Amount' },
      { path: 'currency', description: 'Currency' },
      { path: 'date', description: 'Due date' },
    ],
    defaultRecipients: ['admin'],
  },
  {
    key: 'subscription.charge_due',
    label: 'Subscription charge due',
    description: 'A subscription occurrence is about to charge.',
    category: 'expense',
    placeholders: [
      { path: 'subscription.name', description: 'Subscription name' },
      { path: 'amount', description: 'Amount' },
      { path: 'currency', description: 'Currency' },
      { path: 'date', description: 'Charge date' },
    ],
    defaultRecipients: ['admin'],
  },
  {
    key: 'estimate.sent',
    label: 'Estimate sent to client (manual)',
    description: 'Send the estimate to the client by email for review.',
    category: 'estimate',
    placeholders: [
      ...baseClientPlaceholders,
      { path: 'estimate.title', description: 'Estimate title' },
      { path: 'estimate.amount', description: 'Estimate amount' },
      { path: 'estimate.currency', description: 'Currency' },
      { path: 'estimate.billingPeriod', description: 'monthly / annual / one_time' },
      { path: 'estimate.scope', description: 'Scope of work (free-form)' },
      { path: 'estimate.deliverables', description: 'Array of deliverable strings (use {{#each estimate.deliverables}}…{{/each}})' },
      { path: 'estimate.terms', description: 'Payment terms / conditions' },
      { path: 'estimate.validUntil', description: 'Estimate expiration date' },
      { path: 'service.name', description: 'Service name' },
    ],
    defaultRecipients: ['contract.client'],
  },
  {
    key: 'estimate.reminder',
    label: 'Estimate reminder (manual)',
    description: 'Polite nudge to the client about a pending estimate awaiting decision.',
    category: 'estimate',
    placeholders: [
      ...baseClientPlaceholders,
      { path: 'estimate.title', description: 'Estimate title' },
      { path: 'estimate.amount', description: 'Estimate amount' },
      { path: 'estimate.currency', description: 'Currency' },
      { path: 'estimate.validUntil', description: 'Estimate expiration date' },
      { path: 'daysSinceSent', description: 'Days since estimate was sent' },
    ],
    defaultRecipients: ['contract.client'],
  },
  {
    key: 'loan.payment_due',
    label: 'Loan payment due',
    description: 'A loan payment occurrence is due.',
    category: 'expense',
    placeholders: [
      { path: 'loan.name', description: 'Loan name' },
      { path: 'amount', description: 'Installment amount' },
      { path: 'currency', description: 'Currency' },
      { path: 'date', description: 'Due date' },
    ],
    defaultRecipients: ['admin'],
  },
  {
    key: 'estimate.client_accepted',
    label: 'Client accepted an estimate (link)',
    description:
      'The client accepted a proposal through its PIN-protected link.',
    category: 'estimate',
    placeholders: [
      ...baseClientPlaceholders,
      { path: 'estimate.title', description: 'Estimate title' },
      { path: 'estimate.amount', description: 'Estimate amount' },
      { path: 'estimate.currency', description: 'Currency' },
      {
        path: 'estimate.billingPeriod',
        description: 'monthly / annual / one_time',
      },
      {
        path: 'estimate.id',
        description: 'Estimate id (for a link into Helm)',
      },
      {
        path: 'decision.name',
        description: 'Full name the client signed with',
      },
      { path: 'decision.at', description: 'When (ISO date-time)' },
      { path: 'decision.ip', description: 'IP address it came from' },
    ],
    defaultRecipients: ['admin'],
  },
  {
    key: 'estimate.client_declined',
    label: 'Client declined an estimate (link)',
    description:
      'The client declined a proposal through its PIN-protected link.',
    category: 'estimate',
    placeholders: [
      ...baseClientPlaceholders,
      { path: 'estimate.title', description: 'Estimate title' },
      { path: 'estimate.amount', description: 'Estimate amount' },
      { path: 'estimate.currency', description: 'Currency' },
      {
        path: 'estimate.billingPeriod',
        description: 'monthly / annual / one_time',
      },
      {
        path: 'estimate.id',
        description: 'Estimate id (for a link into Helm)',
      },
      {
        path: 'decision.reason',
        description: 'Reason the client gave (optional)',
      },
      { path: 'decision.at', description: 'When (ISO date-time)' },
    ],
    defaultRecipients: ['admin'],
  },
  {
    key: 'estimate.share_locked',
    label: 'Estimate link locked (wrong PINs)',
    description:
      'A proposal link was locked after too many wrong PINs. Create a new link to reopen it.',
    category: 'estimate',
    placeholders: [
      ...baseClientPlaceholders,
      { path: 'estimate.title', description: 'Estimate title' },
      { path: 'estimate.amount', description: 'Estimate amount' },
      { path: 'estimate.currency', description: 'Currency' },
      {
        path: 'estimate.billingPeriod',
        description: 'monthly / annual / one_time',
      },
      {
        path: 'estimate.id',
        description: 'Estimate id (for a link into Helm)',
      },
    ],
    defaultRecipients: ['admin'],
  },
  {
    key: 'fortnight.plan_missing',
    label: 'Fortnight not planned',
    description:
      'The current fortnight has no plan yet, or the next one starts tomorrow without a plan. Checked daily.',
    category: 'expense',
    placeholders: [
      {
        path: 'period.label',
        description: 'Fortnight to plan',
        example: 'Nov 16–30, 2026',
      },
      {
        path: 'period.key',
        description: 'Fortnight key',
        example: '2026-11-2',
      },
      {
        path: 'startsTomorrow',
        description: 'true when it is the next fortnight, starting tomorrow',
      },
      {
        path: 'previousOpen',
        description: 'true when the previous fortnight was never closed',
      },
    ],
    defaultRecipients: ['admin'],
  },
  {
    key: 'fortnight.lines_overdue',
    label: 'Fortnight items overdue',
    description:
      'Daily digest of planned fortnight items past their due date and not applied yet.',
    category: 'expense',
    placeholders: [
      {
        path: 'period.label',
        description: 'Fortnight',
        example: 'Nov 1–15, 2026',
      },
      { path: 'count', description: 'Number of overdue items', example: '3' },
      {
        path: 'totalUsd',
        description: 'Overdue total in USD',
        example: '420.00',
      },
      {
        path: 'totalNio',
        description: 'Overdue total in córdobas',
        example: '15456.00',
      },
      {
        path: 'items',
        description:
          'Array of { name, amount, currency, dueDate } (use {{#each items}}…{{/each}})',
      },
    ],
    defaultRecipients: ['admin'],
  },
];

export function findEventByKey(key: string): EventDefinition | undefined {
  return EVENT_CATALOG.find((e) => e.key === key);
}
