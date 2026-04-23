// @ts-nocheck
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) and senior technical recruiter.
You compare a candidate's resume against a target job description and return a strict, honest evaluation.
Always respond by calling the provided tool with structured JSON. Do not include prose.`;

function buildUserPrompt(resumeText: string, jobDescription: string) {
  return `RESUME:
"""
${resumeText.slice(0, 15000)}
"""

JOB DESCRIPTION:
"""
${jobDescription.slice(0, 6000)}
"""

Evaluate the resume against the job description as a strict ATS would.
- match_score: 0-100 integer reflecting overall fit (skills, experience, keywords).
- skills_detected: skills/tools/technologies actually present in the resume that the JD asks for.
- missing_keywords: important keywords/skills from the JD that are missing or weakly represented.
- suggestions: 3-6 concrete, actionable improvements (rewrites, additions, quantifiable achievements).
- summary: 2-3 sentence executive summary of fit.

You are also a technical interviewer.
Based on the resume, generate interview questions focused on skills and projects mentioned:
- technical_questions: 5-8 technical questions.
- behavioral_questions: 4-6 behavioral questions.`;
}

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ");
}

function extractKeywords(input: string) {
  const stopwords = new Set([
    "the", "and", "for", "with", "you", "your", "are", "this", "that", "from", "have", "has", "will", "our",
    "their", "they", "them", "was", "were", "been", "into", "about", "would", "could", "should", "can", "may",
    "using", "use", "used", "required", "preferred", "experience", "skills", "skill", "work", "working", "role",
  ]);
  const tokens = normalizeText(input)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stopwords.has(t));

  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      uniq.push(t);
    }
    if (uniq.length >= 60) break;
  }
  return uniq;
}

function buildFallbackResult(resumeText: string, jobDescription: string, reason: string) {
  const resumeNorm = normalizeText(resumeText);
  const jdKeywords = extractKeywords(jobDescription);
  const matched = jdKeywords.filter((k) => resumeNorm.includes(k));
  const missing = jdKeywords.filter((k) => !resumeNorm.includes(k));
  const ratio = jdKeywords.length ? matched.length / jdKeywords.length : 0.5;
  const score = Math.max(35, Math.min(92, Math.round(ratio * 100)));

  return {
    result: {
      match_score: score,
      skills_detected: matched.slice(0, 20),
      missing_keywords: missing.slice(0, 20),
      suggestions: [
        "Mirror the job description wording for your strongest matching skills and tools.",
        "Add 3-5 quantified achievements (impact, scale, and outcomes) for recent roles.",
        "Include missing keywords naturally in bullets where you have real experience.",
        "Tailor the summary section to this exact role and prioritize relevant projects.",
      ],
      summary:
        `Fallback analysis mode was used (${reason}). ` +
        `Matched ${matched.length} of ${jdKeywords.length || 1} target keywords from the job description.`,
      technical_questions: matched.slice(0, 6).map((k) => `Can you explain a project where you used ${k} and the key technical trade-offs you made?`),
      behavioral_questions: [
        "Tell me about a time you had to learn a new technology quickly for a project deadline.",
        "Describe a situation where requirements changed mid-project. How did you adapt?",
        "Tell me about a disagreement with a teammate on implementation. How did you resolve it?",
        "Describe a high-pressure delivery and how you maintained quality.",
      ],
    },
    fallback: true,
    fallback_reason: reason,
    provider_used: "fallback",
  };
}

const tool = {
  type: "function",
  function: {
    name: "return_ats_analysis",
    description: "Return the structured ATS analysis result",
    parameters: {
      type: "object",
      properties: {
        match_score: { type: "integer", minimum: 0, maximum: 100 },
        skills_detected: { type: "array", items: { type: "string" } },
        missing_keywords: { type: "array", items: { type: "string" } },
        suggestions: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        technical_questions: { type: "array", items: { type: "string" } },
        behavioral_questions: { type: "array", items: { type: "string" } },
      },
      required: [
        "match_score",
        "skills_detected",
        "missing_keywords",
        "suggestions",
        "summary",
        "technical_questions",
        "behavioral_questions",
      ],
      additionalProperties: false,
    },
  },
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
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
      }
    : null;
  const geminiConfig = GEMINI_API_KEY
    ? {
        provider: "gemini" as const,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        model: Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash",
      }
    : null;
  const lovableConfig = LOVABLE_API_KEY
    ? {
        provider: "lovable" as const,
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        model: Deno.env.get("LOVABLE_MODEL") || "google/gemini-3-flash-preview",
      }
    : null;

  // Respect explicit provider override first.
  if (forcedProvider === "openai" && openaiConfig) {
    return [openaiConfig];
  }
  if (forcedProvider === "gemini" && geminiConfig) {
    return [geminiConfig];
  }
  if (forcedProvider === "lovable" && lovableConfig) {
    return [lovableConfig];
  }

  // Default order: Gemini (free-tier friendly), OpenAI, then Lovable.
  return [geminiConfig, openaiConfig, lovableConfig].filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const form = await req.formData();
    const file = form.get("resume") as File | null;
    const jobDescription = String(form.get("jobDescription") || "").trim();

    if (!file || !jobDescription) {
      return jsonResponse({ error: "resume file and jobDescription are required" }, 400);
    }

    // Extract text from PDF
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const resumeText = (Array.isArray(text) ? text.join("\n") : text).trim();

    if (resumeText.length < 30) {
      return jsonResponse(
        { error: "Could not extract text from PDF. Try a text-based PDF (not a scan)." },
        400,
      );
    }

    const aiConfigs = getAiConfigs();
    if (!aiConfigs.length) {
      return jsonResponse({
        resumeText,
        ...buildFallbackResult(
          resumeText,
          jobDescription,
          "AI not configured",
        ),
      });
    }

    let aiJson: any = null;
    let aiProviderUsed = "";
    let lastRateLimitError: { provider: string; details: string } | null = null;
    let lastAuthError: { provider: string; status: number; details: string } | null = null;

    for (const ai of aiConfigs) {
      const aiResp = await fetch(ai.url, {
        method: "POST",
        headers: ai.headers,
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(resumeText, jobDescription) },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "return_ats_analysis" } },
        }),
      });

      if (aiResp.ok) {
        aiJson = await aiResp.json();
        aiProviderUsed = ai.provider;
        break;
      }

      const t = await aiResp.text();
      console.error("AI error", ai.provider, aiResp.status, t);

      if (aiResp.status === 429) {
        const lower = (t || "").toLowerCase();
        if (lower.includes("insufficient_quota") || lower.includes("exceeded your current quota")) {
          return jsonResponse({
            resumeText,
            ...buildFallbackResult(
              resumeText,
              jobDescription,
              "OpenAI quota exceeded",
            ),
            provider: ai.provider,
            upstream_status: aiResp.status,
            details: t?.slice(0, 800) || "",
          });
        }
        lastRateLimitError = { provider: ai.provider, details: t?.slice(0, 400) || "" };
        continue;
      }
      if (aiResp.status === 401 || aiResp.status === 403) {
        lastAuthError = {
          provider: ai.provider,
          status: aiResp.status,
          details: t?.slice(0, 800) || "",
        };
        continue;
      }
      if (aiResp.status === 402) {
        return jsonResponse(
          { error: "AI credits exhausted. Add funds in Lovable workspace settings." },
          402,
        );
      }

      // Return a sanitized upstream message to help debugging without leaking secrets.
      const details = t?.slice(0, 800) || "";
      return jsonResponse(
        {
          error: `AI request failed (${ai.provider}, status ${aiResp.status})`,
          provider: ai.provider,
          upstream_status: aiResp.status,
          details,
        },
        502,
      );
    }

    if (!aiJson) {
      if (lastRateLimitError) {
        return jsonResponse(
          {
            error: "Rate limit exceeded across configured AI providers. Please try again shortly.",
            provider: lastRateLimitError.provider,
            details: lastRateLimitError.details,
          },
          429,
        );
      }
      if (lastAuthError) {
        return jsonResponse(
          {
            error: `AI provider authentication failed (${lastAuthError.provider}, status ${lastAuthError.status}). Check provider API key.`,
            provider: lastAuthError.provider,
            upstream_status: lastAuthError.status,
            details: lastAuthError.details,
          },
          502,
        );
      }
      return jsonResponse(
        { error: "AI request failed across configured providers." },
        502,
      );
    }

    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return jsonResponse({ error: `Malformed AI response from ${aiProviderUsed || "provider"}` }, 502);
    }
    const args = JSON.parse(call.function.arguments);

    return new Response(
      JSON.stringify({
        resumeText,
        provider_used: aiProviderUsed || "unknown",
        fallback: false,
        result: {
          match_score: Math.max(0, Math.min(100, Math.round(args.match_score))),
          skills_detected: args.skills_detected || [],
          missing_keywords: args.missing_keywords || [],
          suggestions: args.suggestions || [],
          summary: args.summary || "",
          technical_questions: args.technical_questions || [],
          behavioral_questions: args.behavioral_questions || [],
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-resume error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
