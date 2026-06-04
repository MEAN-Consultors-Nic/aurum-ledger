export type ProjectTemplate = {
  key: string;
  label: string;
  matchers: string[];
  tasks: Array<{ title: string; description?: string; priority?: 'low' | 'medium' | 'high' }>;
  deliverables: string[];
  suggestedCredentials: Array<{ type: string; name: string }>;
};

const WORDPRESS: ProjectTemplate = {
  key: 'wordpress',
  label: 'WordPress development',
  matchers: ['wordpress', 'wp', 'web development', 'website'],
  tasks: [
    { title: 'Discovery call with client', priority: 'high' },
    { title: 'Provision hosting + domain' },
    { title: 'Install WordPress core' },
    { title: 'Install + configure theme' },
    { title: 'Install required plugins (security, SEO, caching, backup)' },
    { title: 'Content migration / data entry' },
    { title: 'On-page SEO basics' },
    { title: 'SSL setup' },
    { title: 'Configure scheduled backups' },
    { title: 'QA on staging' },
    { title: 'Go-live + post-launch QA' },
    { title: 'Handover docs to client' },
  ],
  deliverables: [
    'Domain pointing correctly',
    'SSL certificate active',
    'WordPress admin handover',
    'Backups configured and tested',
    'On-page SEO basics applied',
    'Client training session (if applicable)',
  ],
  suggestedCredentials: [
    { type: 'wordpress', name: 'WordPress admin' },
    { type: 'ftp', name: 'FTP / SFTP' },
    { type: 'mysql', name: 'Database' },
    { type: 'hosting', name: 'cPanel / hosting panel' },
    { type: 'registrar', name: 'Domain registrar' },
  ],
};

const HOSTING: ProjectTemplate = {
  key: 'hosting',
  label: 'Web hosting setup',
  matchers: ['hosting', 'web hosting'],
  tasks: [
    { title: 'Provision hosting account' },
    { title: 'Configure DNS records' },
    { title: 'Set up email accounts' },
    { title: 'Configure SSL' },
    { title: 'Migrate existing site (if applicable)' },
    { title: 'Test deliverability + uptime' },
    { title: 'Handover cPanel access' },
  ],
  deliverables: [
    'Hosting active and accessible',
    'DNS configured correctly',
    'SSL certificate active',
    'Email accounts created',
    'cPanel credentials handed over',
  ],
  suggestedCredentials: [
    { type: 'hosting', name: 'cPanel / hosting' },
    { type: 'ftp', name: 'FTP' },
    { type: 'registrar', name: 'Domain registrar' },
  ],
};

const EMAIL: ProjectTemplate = {
  key: 'corporate-email',
  label: 'Corporate email setup',
  matchers: ['corporate email', 'email', 'correo', 'google workspace', 'workspace', 'm365', 'microsoft 365'],
  tasks: [
    { title: 'Confirm domain access with client' },
    { title: 'Set up provider account (Workspace / M365 / cPanel)' },
    { title: 'Configure MX records' },
    { title: 'Configure SPF / DKIM / DMARC' },
    { title: 'Create user mailboxes' },
    { title: 'Configure email clients (Gmail / Outlook / mobile)' },
    { title: 'Test deliverability inbound + outbound' },
    { title: 'Handover credentials to client' },
  ],
  deliverables: [
    'MX records verified',
    'SPF / DKIM / DMARC configured',
    'All user accounts created',
    'Email tested on at least one device',
    'Admin credentials handed over',
  ],
  suggestedCredentials: [
    { type: 'email_admin', name: 'Email admin console' },
    { type: 'registrar', name: 'Domain registrar (for DNS)' },
  ],
};

const TECH_SUPPORT: ProjectTemplate = {
  key: 'technical-support',
  label: 'Technical support contract',
  matchers: ['technical support', 'soporte', 'support'],
  tasks: [
    { title: 'Kick-off: capture access + scope', priority: 'high' },
    { title: 'Document baseline state' },
    { title: 'Set up ticketing channel (email / WhatsApp / Discord)' },
    { title: 'Monthly review meeting #1' },
  ],
  deliverables: [
    'Access credentials captured',
    'Ticket intake channel agreed with client',
    'SLA expectations documented',
  ],
  suggestedCredentials: [
    { type: 'hosting', name: 'Hosting access' },
    { type: 'wordpress', name: 'CMS admin' },
    { type: 'ftp', name: 'FTP' },
  ],
};

const WEB_DEV: ProjectTemplate = {
  key: 'web-development',
  label: 'Custom web development',
  matchers: ['web dev', 'web app', 'app', 'development', 'desarrollo', 'custom'],
  tasks: [
    { title: 'Requirements + scope confirmation', priority: 'high' },
    { title: 'Wireframes / UX review' },
    { title: 'Visual design' },
    { title: 'Frontend implementation' },
    { title: 'Backend / API implementation' },
    { title: 'Integration + QA' },
    { title: 'Deploy to staging' },
    { title: 'UAT with client' },
    { title: 'Production deploy' },
    { title: 'Handover docs + repo access' },
  ],
  deliverables: [
    'Source code repository handed over',
    'Production environment live',
    'Documentation written',
    'Admin / user accounts created',
    'Post-launch support window agreed',
  ],
  suggestedCredentials: [
    { type: 'git', name: 'Git repository' },
    { type: 'hosting', name: 'Hosting / server' },
    { type: 'mysql', name: 'Database' },
    { type: 'api_key', name: 'Third-party API keys' },
  ],
};

const GENERIC: ProjectTemplate = {
  key: 'generic',
  label: 'Generic project',
  matchers: [],
  tasks: [
    { title: 'Kick-off meeting with client', priority: 'high' },
    { title: 'Capture access + credentials' },
    { title: 'Execute scope of work' },
    { title: 'QA / review' },
    { title: 'Handover to client' },
  ],
  deliverables: [
    'Scope of work delivered',
    'Credentials captured (if applicable)',
    'Handover completed',
  ],
  suggestedCredentials: [],
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  WORDPRESS,
  HOSTING,
  EMAIL,
  TECH_SUPPORT,
  WEB_DEV,
  TECH_SUPPORT,
  GENERIC,
];

export function findTemplateByKey(key: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.key === key);
}

export function inferTemplate(serviceName?: string, contractTitle?: string): ProjectTemplate {
  const haystack = `${serviceName ?? ''} ${contractTitle ?? ''}`.toLowerCase();
  for (const template of PROJECT_TEMPLATES) {
    if (template.key === 'generic') {
      continue;
    }
    if (template.matchers.some((m) => haystack.includes(m))) {
      return template;
    }
  }
  return GENERIC;
}
