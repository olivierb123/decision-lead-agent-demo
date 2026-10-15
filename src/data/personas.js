export const PERSONAS = [
  {
    id: 'sales-rep',
    label: 'Sales Rep',
    allowedDomains: [
      'CRM',
      'Sales Performance',
      'Product Docs',
      'M365',
      'Permits',
      'Climate / Disaster Risk',
    ],
    description: 'Everything tied to running and closing their own deals — no account-health telemetry or support case data.',
  },
  {
    id: 'customer-success',
    label: 'Customer Success',
    allowedDomains: ['CRM', 'Telemetry', 'Support Cases'],
    description: 'Account health and support ownership — no visibility into pipeline mechanics or competitive material.',
  },
  {
    id: 'executive',
    label: 'Executive',
    allowedDomains: [
      'CRM',
      'Sales Performance',
      'Product Docs',
      'M365',
      'Permits',
      'Climate / Disaster Risk',
      'Telemetry',
      'Support Cases',
    ],
    description: 'Full access across all 8 domains.',
  },
]
