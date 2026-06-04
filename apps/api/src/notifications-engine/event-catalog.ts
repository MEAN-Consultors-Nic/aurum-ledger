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
];

export function findEventByKey(key: string): EventDefinition | undefined {
  return EVENT_CATALOG.find((e) => e.key === key);
}
