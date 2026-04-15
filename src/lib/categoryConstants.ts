export interface SubcategoryDef {
  slug: string;
  label: string;
  examples: string[];
  defaultRdPercent: number;
}

export interface CategoryDef {
  slug: string;
  label: string;
  subcategories: SubcategoryDef[];
  isExpense: boolean; // false for revenue/transfers
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: 'salaries_contractors',
    label: 'Salaries & Contractors',
    isExpense: true,
    subcategories: [
      { slug: 'founder_salary', label: 'Founder Salary', examples: ['Sowrabh Behl salary'], defaultRdPercent: 50 },
      { slug: 'offshore_developers', label: 'Offshore Developers', examples: ['Taresh', 'Karan', 'Monzur Hossain', 'MD.Monzur'], defaultRdPercent: 80 },
      { slug: 'local_contractors', label: 'Local Contractors', examples: ['Joel Sarmiento', 'Llama Navarro', 'Mary Noll', 'Llama Andrea'], defaultRdPercent: 60 },
      { slug: 'support_qa', label: 'Support & QA', examples: ['Stephanie Vergara', 'STEPHANIE ANNE MARCELO VERGARA'], defaultRdPercent: 40 },
    ],
  },
  {
    slug: 'infrastructure_tools',
    label: 'Infrastructure & Tools',
    isExpense: true,
    subcategories: [
      { slug: 'ai_ml_tools', label: 'AI/ML Tools', examples: ['Claude.AI', 'Anthropic', 'ChatGPT', 'Perplexity', 'X.AI', 'Suno', 'Trupeer', 'Gamma'], defaultRdPercent: 90 },
      { slug: 'hosting_servers', label: 'Hosting & Servers', examples: ['Railway', 'Supabase', 'GoDaddy', 'Google Cloud', 'CUDO', 'Sharon AI'], defaultRdPercent: 80 },
      { slug: 'dev_tools', label: 'Dev Tools', examples: ['GitHub', 'Linear', 'Loom'], defaultRdPercent: 70 },
      { slug: 'productivity', label: 'Productivity', examples: ['Slack', 'Google Workspace', 'Notion', 'Gamma App'], defaultRdPercent: 30 },
    ],
  },
  {
    slug: 'voice_ai',
    label: 'Voice AI',
    isExpense: true,
    subcategories: [
      { slug: 'voice_inference', label: 'Voice Inference', examples: ['Retell AI', 'Fal.ai', 'Ultravox', 'Daily.co', 'Hume AI'], defaultRdPercent: 100 },
      { slug: 'telephony', label: 'Telephony', examples: ['Twilio', 'Telnyx', 'JustCall', 'LandingSite.ai'], defaultRdPercent: 80 },
      { slug: 'testing', label: 'Testing', examples: ['Cekura'], defaultRdPercent: 100 },
    ],
  },
  {
    slug: 'bank_fees',
    label: 'Bank Fees',
    isExpense: true,
    subcategories: [
      { slug: 'nab_fees', label: 'NAB Fees', examples: ['NAB monthly fee', 'NAB FEES'], defaultRdPercent: 0 },
      { slug: 'wise_fees', label: 'Wise Transfer Fees', examples: ['Wise fee', 'TransferWise'], defaultRdPercent: 0 },
      { slug: 'international_fx', label: 'International FX', examples: ['NAB international transaction fee', 'INTERNATIONAL TRANSACTION FEE'], defaultRdPercent: 0 },
    ],
  },
  {
    slug: 'legal_compliance',
    label: 'Legal & Compliance',
    isExpense: true,
    subcategories: [
      { slug: 'legal_work', label: 'Legal Work', examples: ['solicitor', 'legal invoice'], defaultRdPercent: 10 },
      { slug: 'soc2_audit', label: 'SOC-2 Audit', examples: ['SOC-2', 'security audit'], defaultRdPercent: 20 },
      { slug: 'rd_tax', label: 'R&D Tax Compliance', examples: ['EndureGo Tax', 'R&D compliance'], defaultRdPercent: 0 },
    ],
  },
  {
    slug: 'bookkeeping_accounting',
    label: 'Bookkeeping & Accounting',
    isExpense: true,
    subcategories: [
      { slug: 'bookkeeping', label: 'Bookkeeping', examples: ['Xero', 'Geraldine Pagalilauan', 'Geraldine'], defaultRdPercent: 0 },
      { slug: 'accounting', label: 'Accounting', examples: ['Boss Private Clients', 'EndureGo Tax', 'accountant'], defaultRdPercent: 0 },
    ],
  },
  {
    slug: 'marketing',
    label: 'Marketing',
    isExpense: true,
    subcategories: [
      { slug: 'cold_email', label: 'Cold Email', examples: ['Instantly'], defaultRdPercent: 0 },
      { slug: 'cold_calling', label: 'Cold Calling', examples: ['JustCall', 'Aircall', 'Kixie', 'cold call', 'dialer'], defaultRdPercent: 0 },
      { slug: 'crm', label: 'CRM', examples: ['HubSpot', 'Hubspot'], defaultRdPercent: 0 },
      { slug: 'content_design', label: 'Content & Design', examples: ['content marketing', 'design'], defaultRdPercent: 0 },
      { slug: 'advertising', label: 'Advertising', examples: ['LinkedIn ads', 'Facebook ads'], defaultRdPercent: 0 },
    ],
  },
  {
    slug: 'rent_office',
    label: 'Rent & Office',
    isExpense: true,
    subcategories: [
      { slug: 'coworking', label: 'Coworking', examples: ['Spacecubed', 'SPACECUBED'], defaultRdPercent: 20 },
      { slug: 'office_supplies', label: 'Office Supplies', examples: ['Officeworks', 'stationery'], defaultRdPercent: 0 },
    ],
  },
  {
    slug: 'insurance',
    label: 'Insurance',
    isExpense: true,
    subcategories: [
      { slug: 'workcover', label: 'Workcover', examples: ['Workcover', 'workers compensation'], defaultRdPercent: 0 },
      { slug: 'pi_cyber', label: 'PI & Cyber Insurance', examples: ['professional indemnity', 'cyber insurance', 'PI insurance'], defaultRdPercent: 0 },
    ],
  },
  {
    slug: 'other_expenses',
    label: 'Other Expenses',
    isExpense: true,
    subcategories: [
      { slug: 'miscellaneous', label: 'Miscellaneous', examples: [], defaultRdPercent: 0 },
    ],
  },
  {
    slug: 'revenue',
    label: 'Revenue',
    isExpense: false,
    subcategories: [
      { slug: 'client_revenue', label: 'Client Revenue', examples: ['AgentsAgency', 'REWomen', 'Fair Go Finance', 'client payment'], defaultRdPercent: 0 },
      { slug: 'grants_incentives', label: 'Grants & Incentives', examples: ['R&D tax incentive', 'government grant', 'ATO refund'], defaultRdPercent: 0 },
    ],
  },
  {
    slug: 'internal_transfers',
    label: 'Internal Transfers',
    isExpense: false,
    subcategories: [
      { slug: 'interaccount', label: 'Inter-account Transfer', examples: ['transfer to Wise', 'transfer to NAB', 'account transfer'], defaultRdPercent: 0 },
      { slug: 'salary_transfer', label: 'Salary Transfer', examples: ['payroll', 'salary payment', 'MarchPayroll', 'FebSalary', 'NovSalary', 'DecemberPay'], defaultRdPercent: 0 },
    ],
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]));

export function getSubcategory(categorySlug: string, subcategorySlug: string): SubcategoryDef | undefined {
  return CATEGORY_MAP[categorySlug]?.subcategories.find(s => s.slug === subcategorySlug);
}

export function getAllSubcategories(): Array<SubcategoryDef & { categorySlug: string }> {
  return CATEGORIES.flatMap(c => c.subcategories.map(s => ({ ...s, categorySlug: c.slug })));
}
