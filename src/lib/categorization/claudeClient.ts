import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES } from '@/lib/categoryConstants';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface TransactionInput {
  index: number;
  date: string;
  amount: number;
  details?: string;
  merchant?: string;
  type?: string;
  source: string;
}

export interface CategorizationResult {
  index: number;
  category: string;
  subcategory: string;
  confidence: number;
  reason: string;
  rdEligible: boolean;
  question?: string; // present when confidence < 0.7
}

function buildSystemPrompt(): string {
  const categoryList = CATEGORIES.map(cat => {
    const subcats = cat.subcategories.map(s => `    - ${s.slug}: ${s.label} (e.g. ${s.examples.slice(0, 3).join(', ')})`).join('\n');
    return `- ${cat.slug}: ${cat.label}\n${subcats}`;
  }).join('\n');

  return `You are a financial transaction categorizer for Voice AI Solutions, an Australian AI startup building voice AI products.

## NAB transaction format
NAB descriptions look like: "V2559 DD/MM MERCHANT_NAME REST". Ignore the "V2559 DD/MM" prefix — the merchant name is everything after it. Examples:
- "V2559 09/04 NAB INTNL TRAN FEE - (MC) 74609056099" → bank_fees/international_fx
- "V2559 09/04 RAILWAY RAILWAY.CO 24000776099" → infrastructure_tools/hosting_servers
- "V2559 08/04 JUSTCALL.IO JUSTCALL.I 24011346098" → voice_ai/telephony
- "V2559 07/04 GITHUB GITHUB.COM 24000776096" → infrastructure_tools/dev_tools
- "V2559 06/04 ANTHROPIC ANTHROPIC.COM 24064666097" → infrastructure_tools/ai_ml_tools
- "V2559 05/04 SPACECUBED SPACECUBED 24064666095" → rent_office/coworking
- "V2559 04/04 TWILIO TWILIO.COM 24011346094" → voice_ai/telephony
- "V2559 03/04 SLACK SLACK.COM 24000776093" → infrastructure_tools/productivity
- "V2559 08/04 MOBILE-FIRST VINCENNES 74609056099" → voice_ai/telephony (Mobile-First is a telephony/VoIP reseller)
- "INTERNET BPAY TAX OFFICE PAYMENTS" → legal_compliance/rd_tax
- "FEES" type transactions from NAB → bank_fees/nab_fees

## Categorisation rules
- Wise transfers to contractor names (Stephanie Vergara, Joel Sarmiento, Llama Navarro, Mary Noll, Geraldine Pagalilauan, Monzur Hossain, Taresh) = salaries_contractors
- Wise references like "MarchPayroll", "FebSalary", "NovSalary", "DecemberPay" = internal_transfers/salary_transfer
- NAB "INTNL TRAN FEE" or "INTERNATIONAL TRANSACTION FEE" = bank_fees/international_fx
- Spacecubed = rent_office/coworking
- Xero = bookkeeping_accounting/bookkeeping
- Railway = infrastructure_tools/hosting_servers
- Retell, Daily.co, Ultravox, Hume = voice_ai/voice_inference
- Twilio, Telnyx, JustCall, Mobile-First = voice_ai/telephony
- Claude.AI, Anthropic = infrastructure_tools/ai_ml_tools
- GitHub = infrastructure_tools/dev_tools
- Slack = infrastructure_tools/productivity
- Google Workspace = infrastructure_tools/productivity
- Supabase = infrastructure_tools/hosting_servers
- Positive amounts (credits) with no clear client source = revenue/client_revenue
- For internal_transfers and revenue, rdEligible must be false

## Categories
${categoryList}

## R&D flag
rdEligible: true ONLY for expenses directly related to building/running the Voice AI product (AI tools, voice inference, telephony, R&D developer salaries). false for admin, rent, bank fees, legal, insurance, marketing.

## Output format
Return ONLY a valid JSON array. No explanation, no markdown, no code fences.
High confidence: {"index": 0, "category": "slug", "subcategory": "slug", "confidence": 0.95, "reason": "short reason", "rdEligible": false}
Uncertain (confidence < 0.7): add "question" field: {"index": 0, ..., "confidence": 0.55, "question": "Is this payment to X for contractor work?"}`;
}

export async function categorizeBatch(transactions: TransactionInput[]): Promise<CategorizationResult[]> {
  const systemPrompt = buildSystemPrompt();
  const userMessage = `Categorize these ${transactions.length} transactions:\n${JSON.stringify(transactions, null, 2)}`;

  let attempt = 0;
  let lastError: string = '';

  while (attempt < 2) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 0,
        system: systemPrompt,
        messages: [
          { role: 'user', content: attempt === 0 ? userMessage : `${userMessage}\n\nYou returned invalid JSON. Return ONLY a valid JSON array.` },
        ],
      });

      const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
      // Strip any accidental markdown fences
      const cleaned = text.replace(/```(?:json)?/g, '').trim();
      const results = JSON.parse(cleaned) as CategorizationResult[];

      // Validate structure
      if (!Array.isArray(results)) throw new Error('Not an array');
      return results;
    } catch (err) {
      lastError = String(err);
      attempt++;
    }
  }

  // Surface the real error so the caller (and UI) can handle it properly
  throw new Error(`Claude API error: ${lastError}`);
}
