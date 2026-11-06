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
  { key: 'estimates', name: 'Estimates', description: 'Proposals sent to clients', color: 'sky', order: 0 },
  { key: 'contracts', name: 'Contracts', description: 'Expiry & lifecycle reminders', color: 'indigo', order: 1 },
  { key: 'payments', name: 'Payments', description: 'Overdue & collections', color: 'rose', order: 2 },
  { key: 'projects', name: 'Projects', description: 'Operational alerts', color: 'emerald', order: 3 },
  { key: 'cashflow', name: 'Cashflow', description: 'Planned income / expenses', color: 'amber', order: 4 },
  { key: 'custom', name: 'Custom', description: 'Your own templates', color: 'slate', order: 99 },
];

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    key: 'estimate-sent',
    group: 'estimates',
    name: 'Estimate proposal (to client)',
    description: 'Send the full estimate to the client with scope, deliverables, terms and validity.',
    eventKey: 'estimate.sent',
    subject: 'Estimate: {{estimate.title}} — {{money estimate.amount estimate.currency}}',
    bodyHtml: `<h2 style="margin:0 0 6px 0;font-size:22px;color:#0f172a;">Hi {{client.name}},</h2>
<p style="margin:0 0 18px 0;color:#475569;">Thanks for the conversation. Here's the proposal for your review.</p>

<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:18px;">
  <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Estimate</div>
  <div style="font-size:20px;font-weight:600;color:#0f172a;margin-bottom:4px;">{{estimate.title}}</div>
  <div style="font-size:14px;color:#475569;">Service: {{service.name}}</div>
  <div style="font-size:14px;color:#475569;">Billing: {{estimate.billingPeriod}}</div>
  {{#if estimate.validUntil}}
  <div style="font-size:14px;color:#475569;">Valid until: <strong>{{date estimate.validUntil}}</strong></div>
  {{/if}}
  <div style="margin-top:14px;font-size:30px;font-weight:700;color:#0f172a;">{{money estimate.amount estimate.currency}}</div>
</div>

{{#if estimate.scope}}
<h3 style="margin:24px 0 8px 0;font-size:15px;color:#0f172a;letter-spacing:0.02em;text-transform:uppercase;">Scope</h3>
<div style="color:#1e293b;line-height:1.6;white-space:pre-wrap;">{{estimate.scope}}</div>
{{/if}}

{{#if estimate.deliverables}}
<h3 style="margin:24px 0 8px 0;font-size:15px;color:#0f172a;letter-spacing:0.02em;text-transform:uppercase;">Deliverables</h3>
<ul style="margin:0;padding-left:20px;color:#1e293b;line-height:1.7;">
  {{#each estimate.deliverables}}
  <li>{{this}}</li>
  {{/each}}
</ul>
{{/if}}

{{#if estimate.terms}}
<h3 style="margin:24px 0 8px 0;font-size:15px;color:#0f172a;letter-spacing:0.02em;text-transform:uppercase;">Terms</h3>
<div style="color:#475569;font-size:13px;line-height:1.6;white-space:pre-wrap;">{{estimate.terms}}</div>
{{/if}}

<p style="margin:28px 0 8px 0;color:#1e293b;">Let us know if you'd like to adjust anything or if you're ready to proceed.</p>
<p style="margin:0;color:#1e293b;">Best,<br><strong>MEAN Consultors</strong></p>`,
  },
  {
    key: 'estimate-reminder',
    group: 'estimates',
    name: 'Estimate reminder (to client)',
    description: 'Polite follow-up on a pending estimate.',
    eventKey: 'estimate.reminder',
    subject: 'Quick follow-up on {{estimate.title}}',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#0f172a;">Hi {{client.name}},</h2>
<p>Just a quick follow-up on the estimate <strong>{{estimate.title}}</strong> for <strong>{{money estimate.amount estimate.currency}}</strong>.</p>
{{#if estimate.validUntil}}
<p>This proposal is valid until <strong>{{date estimate.validUntil}}</strong>.</p>
{{/if}}
<p>Let us know if you have any questions, need adjustments, or are ready to proceed. We'd love to help.</p>
<p>Best,<br>MEAN Consultors</p>`,
  },
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
  {
    key: 'estimate-client-accepted',
    group: 'estimates',
    name: 'Client accepted estimate',
    description: 'Tells you a client accepted a proposal through its link.',
    eventKey: 'estimate.client_accepted',
    subject: '{{client.name}} accepted "{{estimate.title}}"',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#047857;">Proposal accepted</h2>
<p><strong>{{client.name}}</strong> accepted <strong>{{estimate.title}}</strong> — {{money estimate.amount estimate.currency}}.</p>
<p>Signed as <strong>{{decision.name}}</strong> on {{date decision.at}} (IP {{decision.ip}}).</p>
<p>Next step: convert it to a contract in Helm.</p>`,
  },
  {
    key: 'estimate-client-declined',
    group: 'estimates',
    name: 'Client declined estimate',
    description: 'Tells you a client declined a proposal through its link.',
    eventKey: 'estimate.client_declined',
    subject: '{{client.name}} declined "{{estimate.title}}"',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#be123c;">Proposal declined</h2>
<p><strong>{{client.name}}</strong> declined <strong>{{estimate.title}}</strong> — {{money estimate.amount estimate.currency}}.</p>
{{#if decision.reason}}<p>Reason: <em>{{decision.reason}}</em></p>{{else}}<p>No reason given.</p>{{/if}}`,
  },
  {
    key: 'estimate-share-locked',
    group: 'estimates',
    name: 'Estimate link locked',
    description: 'A proposal link was locked after too many wrong PINs.',
    eventKey: 'estimate.share_locked',
    subject: 'Link locked: "{{estimate.title}}" ({{client.name}})',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#b45309;">Proposal link locked</h2>
<p>The link for <strong>{{estimate.title}}</strong> ({{client.name}}) was locked after too many wrong PINs.</p>
<p>If it was your client, create a new link from the estimate and send them the new PIN. If not, nothing else is needed: the locked link no longer opens.</p>`,
  },
  {
    key: 'fortnight-plan-missing',
    group: 'cashflow',
    name: 'Plan your fortnight',
    description:
      'Reminder to open the bi-weekly planner for the current or next fortnight.',
    eventKey: 'fortnight.plan_missing',
    subject:
      '{{#if startsTomorrow}}Tomorrow starts {{period.label}} — plan it{{else}}{{period.label}} has no plan yet{{/if}}',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;">Plan your fortnight</h2>
{{#if startsTomorrow}}
<p>The fortnight <strong>{{period.label}}</strong> starts tomorrow and it is not planned yet.</p>
{{else}}
<p>The fortnight <strong>{{period.label}}</strong> is running without a plan.</p>
{{/if}}
<p>Open the <strong>Bi-weekly planner</strong>: loans, recurring expenses, subscriptions and planned income are pulled in automatically — you only add what is missing.</p>
{{#if previousOpen}}<p style="color:#b45309;">The previous fortnight is still open. Close it first so whatever was not paid moves forward.</p>{{/if}}`,
  },
  {
    key: 'fortnight-lines-overdue',
    group: 'cashflow',
    name: 'Fortnight items overdue',
    description:
      'Daily digest of planned items past due in the current fortnight.',
    eventKey: 'fortnight.lines_overdue',
    subject: '{{count}} planned item(s) overdue — {{period.label}}',
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:18px;color:#be123c;">Overdue in {{period.label}}</h2>
<p>These items were due and are not applied yet. Apply what was paid, skip or move the rest.</p>
<table style="width:100%;border-collapse:collapse;margin:18px 0;">
{{#each items}}
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">{{name}}<br><span style="color:#64748b;font-size:12px;">due {{date dueDate}}</span></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">{{money amount currency}}</td></tr>
{{/each}}
</table>
<p>Total: <strong>{{money totalUsd "USD"}}</strong> (≈ {{money totalNio "NIO"}})</p>`,
  },
];

/**
 * Rules created once, when their event has no rule at all. They are ordinary
 * rules afterwards: edit or disable them in the Notification center.
 */
export type SeedRule = {
  name: string;
  eventKey: string;
  templateName: string;
  recipients: string[];
};

export const SEED_RULES: SeedRule[] = [
  {
    name: 'Client accepted estimate',
    eventKey: 'estimate.client_accepted',
    templateName: 'Client accepted estimate',
    recipients: ['admin'],
  },
  {
    name: 'Client declined estimate',
    eventKey: 'estimate.client_declined',
    templateName: 'Client declined estimate',
    recipients: ['admin'],
  },
  {
    name: 'Estimate link locked',
    eventKey: 'estimate.share_locked',
    templateName: 'Estimate link locked',
    recipients: ['admin'],
  },
  {
    name: 'Plan your fortnight',
    eventKey: 'fortnight.plan_missing',
    templateName: 'Plan your fortnight',
    recipients: ['admin'],
  },
  {
    name: 'Fortnight items overdue',
    eventKey: 'fortnight.lines_overdue',
    templateName: 'Fortnight items overdue',
    recipients: ['admin'],
  },
];
