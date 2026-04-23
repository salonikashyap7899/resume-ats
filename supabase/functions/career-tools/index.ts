// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAiConfigs() {
  const forcedProvider = (Deno.env.get("AI_PROVIDER") || "").trim().toLowerCase();
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  const openaiConfig = OPENAI_API_KEY
    ? {
        provider: "openai" as const,
        url: "https://api.openai.com/v1/chat/completions",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
      }
    : null;
  const geminiConfig = GEMINI_API_KEY
    ? {
        provider: "gemini" as const,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
        model: Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash",
      }
    : null;
  const lovableConfig = LOVABLE_API_KEY
    ? {
        provider: "lovable" as const,
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        model: Deno.env.get("LOVABLE_MODEL") || "google/gemini-3-flash-preview",
      }
    : null;

  if (forcedProvider === "openai" && openaiConfig) return [openaiConfig];
  if (forcedProvider === "gemini" && geminiConfig) return [geminiConfig];
  if (forcedProvider === "lovable" && lovableConfig) return [lovableConfig];
  return [geminiConfig, openaiConfig, lovableConfig].filter(Boolean);
}

async function runAiJson(userPrompt: string, schema: object) {
  const aiConfigs = getAiConfigs();
  const tool = {
    type: "function",
    function: {
      name: "return_result",
      description: "Return structured JSON result",
      parameters: schema,
    },
  };

  for (const ai of aiConfigs) {
    const resp = await fetch(ai.url, {
      method: "POST",
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: "Return only tool output." },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_result" } },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      const low = t.toLowerCase();
      if (resp.status === 429 || resp.status === 401 || resp.status === 403 || low.includes("insufficient_quota")) continue;
      throw new Error(`AI call failed (${ai.provider}, ${resp.status})`);
    }
    const json = await resp.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) continue;
    return { provider: ai.provider, data: JSON.parse(call.function.arguments) };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const resumeText = String(body.resumeText || "");
    const jobDescription = String(body.jobDescription || "");

    if (action === "resume_template") {
      const schema = {
        type: "object",
        properties: {
          headline: { type: "string" },
          summary: { type: "string" },
          skills: { type: "array", items: { type: "string" } },
          experience_bullets: { type: "array", items: { type: "string" } },
          projects_bullets: { type: "array", items: { type: "string" } },
        },
        required: ["headline", "summary", "skills", "experience_bullets", "projects_bullets"],
        additionalProperties: false,
      };
      const prompt = `Create an ATS-safe polished resume layout from this resume and JD.\nResume:\n${resumeText.slice(0, 14000)}\nJD:\n${jobDescription.slice(0, 5000)}`;
      const ai = await runAiJson(prompt, schema);
      if (ai) return jsonResponse({ ...ai.data, provider_used: ai.provider, fallback: false });
      return jsonResponse({
        headline: "Software Engineer",
        summary: "Results-driven engineer focused on delivering reliable, high-impact software outcomes.",
        skills: ["JavaScript", "React", "TypeScript", "REST APIs"],
        experience_bullets: ["Built and shipped user-facing features with measurable impact.", "Improved code quality and delivery velocity through better engineering practices."],
        projects_bullets: ["Developed production-ready projects aligned to role requirements."],
        provider_used: "fallback",
        fallback: true,
      });
    }

    if (action === "cover_letter") {
      const schema = {
        type: "object",
        properties: { cover_letter: { type: "string" } },
        required: ["cover_letter"],
        additionalProperties: false,
      };
      const prompt = `Write a concise professional cover letter tailored to this JD and resume. Company: ${body.company || ""}. Role: ${body.role || ""}. Resume:${resumeText.slice(0, 12000)} JD:${jobDescription.slice(0, 5000)}`;
      const ai = await runAiJson(prompt, schema);
      if (ai) return jsonResponse({ cover_letter: ai.data.cover_letter, provider_used: ai.provider, fallback: false });
      return jsonResponse({
        cover_letter: `Dear Hiring Manager,\n\nI am excited to apply for this role. My background aligns with your requirements, and I have delivered practical engineering outcomes in similar stacks.\n\nSincerely,\nCandidate`,
        provider_used: "fallback",
        fallback: true,
      });
    }

    if (action === "roadmap") {
      const schema = {
        type: "object",
        properties: {
          days_30: { type: "array", items: { type: "string" } },
          days_60: { type: "array", items: { type: "string" } },
          days_90: { type: "array", items: { type: "string" } },
        },
        required: ["days_30", "days_60", "days_90"],
        additionalProperties: false,
      };
      const prompt = `Create a 30/60/90 day skill-gap roadmap based on missing keywords: ${JSON.stringify(body.missingKeywords || [])}. Resume:${resumeText.slice(0, 10000)} JD:${jobDescription.slice(0, 4000)}`;
      const ai = await runAiJson(prompt, schema);
      if (ai) return jsonResponse({ ...ai.data, provider_used: ai.provider, fallback: false });
      const mk = Array.isArray(body.missingKeywords) ? body.missingKeywords : [];
      return jsonResponse({
        days_30: [`Complete focused fundamentals on ${mk[0] || "core skills"}.`, "Build one mini-project and publish it."],
        days_60: [`Apply ${mk[1] || "advanced topics"} in a production-style project.`, "Add tests and measurable outcomes to portfolio."],
        days_90: ["Run mock interviews weekly and refine weak areas.", "Ship capstone aligned to target role JD."],
        provider_used: "fallback",
        fallback: true,
      });
    }

    if (action === "score_interview") {
      const question = String(body.question || "");
      const answer = String(body.answer || "");
      const schema = {
        type: "object",
        properties: {
          clarity: { type: "integer", minimum: 0, maximum: 100 },
          impact: { type: "integer", minimum: 0, maximum: 100 },
          technical_depth: { type: "integer", minimum: 0, maximum: 100 },
          feedback: { type: "string" },
        },
        required: ["clarity", "impact", "technical_depth", "feedback"],
        additionalProperties: false,
      };
      const prompt = `Score this interview answer out of 100 for clarity, impact, technical depth.\nQuestion:${question}\nAnswer:${answer}\nGive concise coaching feedback.`;
      const ai = await runAiJson(prompt, schema);
      if (ai) return jsonResponse({ ...ai.data, provider_used: ai.provider, fallback: false });
      const lengthScore = Math.min(95, Math.max(40, Math.round(answer.length / 6)));
      return jsonResponse({
        clarity: lengthScore,
        impact: Math.max(35, lengthScore - 5),
        technical_depth: Math.max(30, lengthScore - 10),
        feedback: "Use STAR structure, quantify impact, and include specific technical decisions/trade-offs.",
        provider_used: "fallback",
        fallback: true,
      });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
