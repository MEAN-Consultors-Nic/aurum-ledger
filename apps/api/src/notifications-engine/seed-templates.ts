export type SeedTemplate = {
  key: string;
  name: string;
  description: string;
  eventKey: string;
  group: string;
  subject: string;
  bodyHtml: string;
};

export type SeedGroup = {
  key: string;
  name: string;
  description: string;
  color: string;
  order: number;
};

export const SEED_GROUPS: SeedGroup[] = [
  { key: 'contracts', name: 'Contracts', description: 'Expiry & lifecycle reminders', color: 'indigo', order: 1 },
  { key: 'payments', name: 'Payments', description: 'Overdue & collections', color: 'rose', order: 2 },
  { key: 'projects', name: 'Projects', description: 'Operational alerts', color: 'emerald', order: 3 },
  { key: 'cashflow', name: 'Cashflow', description: 'Planned income / expenses', color: 'amber', order: 4 },
  { key: 'custom', name: 'Custom', description: 'Your own templates', color: 'slate', order: 99 },
];

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    key: 'contract-expiring',
    group: 'contracts',
    name: 'Contract expiring soon',
    description: 'Heads-up before a recurring contract renews or one-off contract ends.',
    eventKey: 'contract.expiring_soon',
    subject: '[Reminder] {{contract.title}} expires in {{daysUntilExpiry}} days',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;">Contract expiring soon</h2>
<p>The contract <strong>{{contract.title}}</strong> for <strong>{{client.name}}</strong> is scheduled to expire on <strong>{{date contract.endDate}}</strong> — that's <strong>{{daysUntilExpiry}}</strong> days from now.</p>
<table style="width:100%;border-collapse:collapse;margin:18px 0;">
  <tr><td style="padding:6px 0;color:#64748b;">Amount</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{money contract.amount contract.currency}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Service</td><td style="padding:6px 0;text-align:right;">{{service.name}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Billing period</td><td style="padding:6px 0;text-align:right;">{{contract.billingPeriod}}</td></tr>
</table>
<p>Now is a good time to reach out to the client about renewal or close-out.</p>`,
  },
  {
    key: 'payment-overdue',
    group: 'payments',
    name: 'Payment overdue',
    description: 'Internal alert when a contract is past due with open balance.',
    eventKey: 'payment.overdue',
    subject: '[Overdue] {{client.name}} — {{money balance contract.currency}} pending {{daysOverdue}}d',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#be123c;">Payment overdue</h2>
<p><strong>{{client.name}}</strong> has an outstanding balance on <strong>{{contract.title}}</strong>.</p>
<p style="font-size:28px;font-weight:600;margin:18px 0;">{{money balance contract.currency}}</p>
<p>Original due date: <strong>{{date contract.endDate}}</strong> ({{daysOverdue}} days overdue).</p>
<p>Consider following up with the client to confirm payment status.</p>`,
  },
  {
    key: 'project-due-soon',
    group: 'projects',
    name: 'Project due soon',
    description: 'Heads-up when a project deadline approaches.',
    eventKey: 'project.due_soon',
    subject: 'Project "{{project.name}}" is due in {{daysUntilDue}} days',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;">Project deadline approaching</h2>
<p>The project <strong>{{project.name}}</strong> for <strong>{{client.name}}</strong> is due on <strong>{{date project.dueDate}}</strong> ({{daysUntilDue}} days).</p>
<p>Review the open tasks and deliverables to make sure everything ships on time.</p>`,
  },
  {
    key: 'task-overdue',
    group: 'projects',
    name: 'Task overdue',
    description: 'Internal alert when a task is past due in an active project.',
    eventKey: 'project.task_overdue',
    subject: '[Overdue task] {{task.title}} — {{project.name}}',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#b45309;">Task overdue</h2>
<p>Task <strong>{{task.title}}</strong> in project <strong>{{project.name}}</strong> was due on <strong>{{date task.dueDate}}</strong> and is now <strong>{{daysOverdue}}</strong> days overdue.</p>
<p>Priority: <strong>{{uppercase task.priority}}</strong></p>`,
  },
  {
    key: 'planned-income-overdue',
    group: 'cashflow',
    name: 'Planned income overdue',
    description: 'Heads-up that an expected income did not come in on schedule.',
    eventKey: 'planned_income.overdue',
    subject: 'Planned income "{{plannedIncome.name}}" is {{daysOverdue}}d overdue',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;">Planned income overdue</h2>
<p>The planned income <strong>{{plannedIncome.name}}</strong> of <strong>{{money amount currency}}</strong> was scheduled for <strong>{{date date}}</strong> and is now <strong>{{daysOverdue}}</strong> days overdue.</p>
<p>Confirm it manually from Planned income if it has been received, or follow up with the source.</p>`,
  },
  {
    key: 'contract-payment-reminder',
    group: 'contracts',
    name: 'Payment reminder (to client)',
    description: 'Polite reminder sent to the client about a pending balance.',
    eventKey: 'contract.payment_reminder',
    subject: 'Friendly reminder: outstanding balance on {{contract.title}}',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;">Hi {{client.name}},</h2>
<p>This is a friendly reminder that the contract <strong>{{contract.title}}</strong> still has an outstanding balance of <strong>{{money balance contract.currency}}</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin:18px 0;">
  <tr><td style="padding:6px 0;color:#64748b;">Service</td><td style="padding:6px 0;text-align:right;">{{service.name}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Original due date</td><td style="padding:6px 0;text-align:right;">{{date contract.endDate}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Pending amount</td><td style="padding:6px 0;text-align:right;font-weight:600;">{{money balance contract.currency}}</td></tr>
</table>
<p>We'd appreciate it if you could confirm the payment or let us know if there's anything blocking it.</p>
<p>Thanks,<br>MEAN Consultors</p>`,
  },
  {
    key: 'contract-suspension-notice',
    group: 'contracts',
    name: 'Suspension notice (to client)',
    description: 'Warning the client that service will be suspended due to unpaid balance.',
    eventKey: 'contract.suspension_notice',
    subject: 'Important: service suspension notice for {{contract.title}}',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#be123c;">Hi {{client.name}},</h2>
<p>We have been unable to confirm payment on the contract <strong>{{contract.title}}</strong>, which has been outstanding for <strong>{{daysOverdue}}</strong> days.</p>
<table style="width:100%;border-collapse:collapse;margin:18px 0;">
  <tr><td style="padding:6px 0;color:#64748b;">Service</td><td style="padding:6px 0;text-align:right;">{{service.name}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Original due date</td><td style="padding:6px 0;text-align:right;">{{date contract.endDate}}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Pending amount</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#be123c;">{{money balance contract.currency}}</td></tr>
</table>
<p>Unless we receive payment or hear from you in the next few business days, we will need to suspend the service. To avoid interruption, please reach out as soon as possible so we can find a way forward.</p>
<p>Thanks,<br>MEAN Consultors</p>`,
  },
  {
    key: 'contract-expired',
    group: 'contracts',
    name: 'Contract expired',
    description: 'Alert when a contract endDate passes (renewal needed).',
    eventKey: 'contract.expired',
    subject: '[Expired] {{contract.title}} — {{client.name}}',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#be123c;">Contract expired</h2>
<p>The contract <strong>{{contract.title}}</strong> for <strong>{{client.name}}</strong> reached its end date on <strong>{{date contract.endDate}}</strong>.</p>
<p>Decide whether to renew, replace, or cancel formally.</p>`,
  },
];
