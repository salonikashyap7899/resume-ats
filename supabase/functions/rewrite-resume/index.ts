// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are an expert resume writer and technical recruiter.
Rewrite resume content to improve ATS performance while staying truthful.
Return output only through the provided function tool.`;

const tool = {
  type: "function",
  function: {
    name: "return_resume_rewrite",
    description: "Return rewritten resume sections",
    parameters: {
      type: "object",
      properties: {
        rewritten_summary: { type: "string" },
        rewritten_experience_bullets: { type: "array", items: { type: "string" } },
        rewritten_project_bullets: { type: "array", items: { type: "string" } },
      },
      required: [
        "rewritten_summary",
        "rewritten_experience_bullets",
        "rewritten_project_bullets",
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

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ");
}

function extractKeywords(input: string) {
  return Array.from(
    new Set(
      normalizeText(input)
        .split(/\s+/)
        .filter((w) => w.length >= 4)
        .slice(0, 40),
    ),
  );
}

function fallbackRewrite(resumeText: string, jobDescription: string) {
  const lines = resumeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const keywords = extractKeywords(jobDescription).slice(0, 10);
  const experience = lines
    .filter((l) => /^[-*•]/.test(l) || /\b(built|developed|implemented|led|optimized)\b/i.test(l))
    .slice(0, 6)
    .map((l, i) => `Delivered impact in scope ${i + 1}: ${l.replace(/^[-*•]\s*/, "")}`);
  const projects = lines
    .filter((l) => /\b(project|app|platform|api|dashboard|system)\b/i.test(l))
    .slice(0, 4)
    .map((l) => `Built ${l.replace(/^[-*•]\s*/, "")}`);

  return {
    rewritten_summary:
      `Results-driven engineer with hands-on delivery across ${keywords.slice(0, 4).join(", ")}. ` +
      `Strong focus on production quality, measurable outcomes, and cross-functional execution.`,
    rewritten_experience_bullets: experience.length
      ? experience
      : ["Improved delivery quality by implementing measurable engineering outcomes and clear ownership."],
    rewritten_project_bullets: projects.length
      ? projects
      : ["Built and shipped production-ready features aligned to target role requirements."],
    fallback: true,
    provider_used: "fallback",
  };
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

  if (forcedProvider === "openai" && openaiConfig) return [openaiConfig];
  if (forcedProvider === "gemini" && geminiConfig) return [geminiConfig];
  if (forcedProvider === "lovable" && lovableConfig) return [lovableConfig];
  return [geminiConfig, openaiConfig, lovableConfig].filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeText, jobDescription = "" } = await req.json();
    const cleanResumeText = String(resumeText || "").trim();
    const cleanJd = String(jobDescription || "").trim();

    if (!cleanResumeText || cleanResumeText.length < 30) {
      return jsonResponse({ error: "resumeText is required" }, 400);
    }

    const aiConfigs = getAiConfigs();
    if (!aiConfigs.length) {
      return jsonResponse(fallbackRewrite(cleanResumeText, cleanJd));
    }

    for (const ai of aiConfigs) {
      const resp = await fetch(ai.url, {
        method: "POST",
        headers: ai.headers,
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Rewrite this resume for ATS optimization based on the job description.\n\nResume:\n${cleanResumeText.slice(0, 15000)}\n\nJob description:\n${cleanJd.slice(0, 6000)}\n\nRequirements:\n- Keep claims truthful and realistic.\n- Return a concise summary (3-4 lines).\n- Return 5-8 impact-focused experience bullets.\n- Return 3-5 project bullets focused on engineering depth.`,
            },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "return_resume_rewrite" } },
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        const low = t.toLowerCase();
        if (resp.status === 429 || resp.status === 401 || resp.status === 403 || low.includes("insufficient_quota")) {
          continue;
        }
        return jsonResponse(
          {
            error: `Rewrite request failed (${ai.provider}, status ${resp.status})`,
            details: t.slice(0, 800),
          },
          502,
        );
      }

      const json = await resp.json();
      const call = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!call) continue;

      const args = JSON.parse(call.function.arguments);
      return jsonResponse({
        rewritten_summary: args.rewritten_summary || "",
        rewritten_experience_bullets: args.rewritten_experience_bullets || [],
        rewritten_project_bullets: args.rewritten_project_bullets || [],
        fallback: false,
        provider_used: ai.provider,
      });
    }

    return jsonResponse(fallbackRewrite(cleanResumeText, cleanJd));
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
