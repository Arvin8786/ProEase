import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy GoogleGenAI initialization
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Executive AI Analytics Endpoint
app.post('/api/gemini/executive-analytics', async (req, res) => {
  try {
    const { task, contextData } = req.body;
    if (!task) {
      return res.status(400).json({ error: 'Missing analysis task parameter' });
    }

    const ai = getAiClient();
    let prompt = '';

    if (task === 'financial_summary') {
      prompt = `You are a Chief Financial Officer (CFO) and SME Financial Analyst.
Analyze the following corporate financial data and provide an executive-level P&L synthesis.
Context Data:
${JSON.stringify(contextData, null, 2)}

Provide your analysis structured with these sections:
1. Executive P&L Overview (Revenue run-rate, Gross Margin %, Operating Expenses)
2. Cash Flow & Liquidity Health Assessment
3. Top Expense Drivers & Anomaly Flags
4. 3 Concrete Actionable Directives for the Managing Director / Owner

Keep the tone professional, objective, high-conviction, and tailored for Singapore / Malaysia SME operations.`;
    } else if (task === 'inventory_reorder') {
      prompt = `You are an AI Supply Chain Director and Inventory Optimization Specialist.
Analyze the following inventory stock levels, min-stock safety limits, sales velocity, and vendor lead times.
Context Data:
${JSON.stringify(contextData, null, 2)}

Provide your recommendations structured with:
1. Critical Stock-Out Risk Warnings (SKUs at or below safety stock minStock)
2. Projected Stock-Out Timeline & Depletion Run-Rate
3. Recommended Restock Purchase Quantities & Priority Vendors
4. Working Capital Optimization (Identifying slow-moving tied-up capital)`;
    } else if (task === 'labor_optimization') {
      prompt = `You are an AI Operations & Workforce Rostering Specialist.
Analyze the following POS checkout hourly transaction distributions against current employee shift roster allocations.
Context Data:
${JSON.stringify(contextData, null, 2)}

Provide your recommendations structured with:
1. Peak vs. Trough Checkout Hour Analysis
2. Staffing Bottlenecks & Overstaffing Periods
3. Optimized Weekly Roster Recommendations (Cashiers, Storekeepers, Supervisors)
4. Estimated Overtime / Hourly Labor Cost Savings`;
    } else {
      prompt = `Perform an executive SME business analysis on the following data:
${JSON.stringify(contextData, null, 2)}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const analysisText = response.text || 'Analysis completed.';
    res.json({ success: true, analysis: analysisText, model: 'gemini-2.5-flash' });
  } catch (error: any) {
    console.error('Executive AI generation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate executive analysis',
      hint: !process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY is not configured in settings.' : undefined
    });
  }
});

// Vite middleware & SPA fallback
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProEaseERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
