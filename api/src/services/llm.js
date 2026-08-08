/**
 * LLM Risk Report Generator for Deploy Doctor (Section 8 of PLAN.md)
 */

const SYSTEM_PROMPT = `
You are a Principal Cloud Architect and Zerops deployment reviewer. You analyze application codebases to evaluate deployment readiness for Zerops Cloud PaaS.

You will be provided:
1. Detected Stack, Framework, and Architectural Features (Databases, Storage, Queues, AI/ML, WebSockets, File Uploads)
2. File tree sample of the repository
3. Generated zerops.yaml manifest
4. Deterministic rule-based findings

Return ONLY a valid JSON object matching this exact schema:
{
  "risks": [
    { "severity": "high|medium|low", "title": "...", "explanation": "..." }
  ],
  "notes": "A 2-3 sentence technical diagnosis detailing why this specific architecture was generated for this repository, referencing specific files and features."
}

Rules:
- Be highly specific to the repository given.
- Reference actual file names from the file tree (e.g. package.json, requirements.txt, .env.example, Dockerfile, etc.).
- Never output generic fluff or markdown formatting outside the JSON object.
`;

export async function generateRiskReport(detectedStack, files, zeropsYaml, ruleRisks = []) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

  const fallbackReport = {
    risks: ruleRisks.length > 0 ? ruleRisks : [
      {
        severity: 'low',
        title: 'Standard Deployment Configuration',
        explanation: `Application detected as ${detectedStack}. Ensure all environment variables are properly configured in Zerops.`
      }
    ],
    notes: `This repository was detected as ${detectedStack}. Zerops will compile and execute your application according to the generated zerops.yaml specification.`
  };

  if (!apiKey) {
    console.log('[Deploy Doctor LLM] LLM_API_KEY / GEMINI_API_KEY not configured, using rule-based report.');
    return fallbackReport;
  }

  // Set 3.5 second timeout for LLM call per Section 8
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const userPrompt = `
Detected Stack: ${detectedStack}
File Tree (sample): ${JSON.stringify(files.slice(0, 30))}
Generated zerops.yaml:
${zeropsYaml}
Rule-based findings: ${JSON.stringify(ruleRisks)}
`;

    const isGemini = process.env.GEMINI_API_KEY || (apiKey && apiKey.startsWith('AIza'));
    const endpointUrl = isGemini
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : (process.env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions');
    const defaultModel = isGemini ? 'gemini-2.0-flash' : 'gpt-4o-mini';

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || defaultModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content;
      if (rawText) {
        const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
        // Merge LLM risks with rule-based risks
        const combinedRisks = [...ruleRisks, ...(parsed.risks || [])];
        // Deduplicate by title
        const uniqueRisks = Array.from(new Map(combinedRisks.map(r => [r.title, r])).values());
        return {
          risks: uniqueRisks,
          notes: parsed.notes || fallbackReport.notes
        };
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[Deploy Doctor LLM] LLM call failed or timed out, falling back to rule report:', err.message);
  }

  return fallbackReport;
}
