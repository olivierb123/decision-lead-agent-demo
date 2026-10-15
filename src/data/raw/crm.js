export const accounts = [
  {
    accountId: 'ACC-1001',
    name: 'Apex Design & Build',
    industry: 'Commercial Construction',
    territory: 'West',
    segment: 'Mid-Market',
    accountTeamOwner: 'Dana Whitfield',
    arr: 184000,
  },
  {
    accountId: 'ACC-1002',
    name: 'Summit Ridge Builders',
    industry: 'Residential Construction',
    territory: 'Central',
    segment: 'Enterprise',
    accountTeamOwner: 'Marcus Cole',
    arr: 412000,
  },
  {
    accountId: 'ACC-1003',
    name: 'Coastal Grade & Pave',
    industry: 'Civil / Infrastructure',
    territory: 'South',
    segment: 'Mid-Market',
    accountTeamOwner: 'Priya Nandan',
    arr: 96000,
  },
]

export const opportunities = [
  {
    opportunityId: 'OPP-5501',
    accountId: 'ACC-1001',
    name: 'Apex – Field Ops Expansion',
    stage: 'Negotiation',
    amount: 76000,
    closeDate: '2026-10-15',
    type: 'Upsell',
    owner: 'Dana Whitfield',
  },
  {
    opportunityId: 'OPP-5502',
    accountId: 'ACC-1002',
    name: 'Summit Ridge – Multi-site Rollout',
    stage: 'Proposal',
    amount: 210000,
    closeDate: '2026-11-30',
    type: 'Cross-sell',
    owner: 'Marcus Cole',
  },
  {
    opportunityId: 'OPP-5503',
    accountId: 'ACC-1003',
    name: 'Coastal Grade – New Logo',
    stage: 'Qualification',
    amount: 58000,
    closeDate: '2026-12-20',
    type: 'New Business',
    owner: 'Priya Nandan',
  },
]

export const leads = [
  {
    leadId: 'LEAD-9001',
    accountId: null,
    source: 'Permit filing trigger',
    status: 'New',
    createdDate: '2026-09-18',
    owner: 'Priya Nandan',
  },
  {
    leadId: 'LEAD-9002',
    accountId: 'ACC-1001',
    source: 'Product usage signal',
    status: 'Working',
    createdDate: '2026-09-10',
    owner: 'Dana Whitfield',
  },
]
