import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/analyze")({
  component: AnalyzePage,
  head: () => ({ meta: [{ title: "Analyze resume — ResumeATS" }] }),
});

type Result = {
  match_score: number;
  skills_detected: string[];
  missing_keywords: string[];
  suggestions: string[];
  summary: string;
  technical_questions: string[];
  behavioral_questions: string[];
};
type AnalyzeMeta = {
  fallback: boolean;
  providerUsed: string;
};
type RewriteResult = {
  rewritten_summary: string;
  rewritten_experience_bullets: string[];
  rewritten_project_bullets: string[];
  fallback: boolean;
  provider_used: string;
};
type RewriteHistoryRow = {
  id: string;
  rewritten_summary: string;
  rewritten_experience_bullets: string[];
  rewritten_project_bullets: string[];
  created_at: string;
};
type ResumeTemplateResult = {
  headline: string;
  summary: string;
  skills: string[];
  experience_bullets: string[];
  projects_bullets: string[];
  fallback: boolean;
  provider_used: string;
};
type RoadmapResult = {
  days_30: string[];
  days_60: string[];
  days_90: string[];
  fallback: boolean;
  provider_used: string;
};
type InterviewScoreResult = {
  clarity: number;
  impact: number;
  technical_depth: number;
  feedback: string;
  fallback: boolean;
  provider_used: string;
};
type ApplicationRow = {
  id: string;
  company: string;
  role: string;
  status: string;
  outcome: string | null;
  created_at: string;
};
type SourceMeta = {
  fallback: boolean;
  provider_used: string;
};

const buildClientFallbackRewrite = (resumeText: string, jobDescription: string): RewriteResult => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ");
  const kws = Array.from(
    new Set(
      norm(jobDescription)
        .split(/\s+/)
        .filter((w) => w.length >= 4)
        .slice(0, 10),
    ),
  );
  const lines = resumeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const experience = lines
    .filter((l) => /^[-*•]/.test(l) || /\b(built|developed|implemented|led|optimized|shipped)\b/i.test(l))
    .slice(0, 6)
    .map((l) => l.replace(/^[-*•]\s*/, ""));
  const projects = lines
    .filter((l) => /\b(project|app|platform|api|dashboard|system)\b/i.test(l))
    .slice(0, 4)
    .map((l) => l.replace(/^[-*•]\s*/, ""));

  return {
    rewritten_summary:
      `Results-focused engineer with practical experience in ${kws.slice(0, 4).join(", ") || "modern software delivery"}. ` +
      `Known for shipping reliable features, improving quality, and collaborating across teams to deliver measurable outcomes.`,
    rewritten_experience_bullets: experience.length
      ? experience
      : ["Improved delivery quality by owning features end-to-end and measuring business impact."],
    rewritten_project_bullets: projects.length
      ? projects
      : ["Built and shipped projects aligned with role requirements and production best practices."],
    fallback: true,
    provider_used: "client-fallback",
  };
};

function AnalyzePage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [analyzeMeta, setAnalyzeMeta] = useState<AnalyzeMeta | null>(null);
  const [originalResumeText, setOriginalResumeText] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [rewriteHistory, setRewriteHistory] = useState<RewriteHistoryRow[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [resumeTemplate, setResumeTemplate] = useState<ResumeTemplateResult | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterMeta, setCoverLetterMeta] = useState<SourceMeta | null>(null);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [roadmap, setRoadmap] = useState<RoadmapResult | null>(null);
  const [interviewQuestion, setInterviewQuestion] = useState("");
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewScore, setInterviewScore] = useState<InterviewScoreResult | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else {
        loadRewriteHistory();
        loadApplications();
      }
    });
  }, [navigate]);

  const loadRewriteHistory = async () => {
    const { data, error } = await supabase
      .from("rewrite_revisions")
      .select("id, rewritten_summary, rewritten_experience_bullets, rewritten_project_bullets, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (!error) {
      setRewriteHistory((data as unknown as RewriteHistoryRow[]) ?? []);
    }
  };

  const loadApplications = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("id, company, role, status, outcome, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error) setApplications((data as unknown as ApplicationRow[]) ?? []);
  };

  const onPick = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") return toast.error("Please upload a PDF file.");
    if (f.size > 10 * 1024 * 1024) return toast.error("Max 10 MB.");
    setFile(f);
  };

  const analyze = async () => {
    if (!file) return toast.error("Upload a resume PDF first.");
    if (jd.trim().length < 30) return toast.error("Paste the job description (at least 30 characters).");
    setLoading(true);
    setResult(null);
    setAnalyzeMeta(null);
    setRewriteResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let session = sessionData.session;
      if (!session) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session) {
          navigate({ to: "/auth" });
          throw new Error("Session expired. Please sign in again.");
        }
        session = refreshed.session;
      }

      const fd = new FormData();
      fd.append("resume", file);
      fd.append("jobDescription", jd);

      const { data, error } = await supabase.functions.invoke("analyze-resume", {
        body: fd,
      });
      if (error) {
        const context = (error as any)?.context;
        if (context instanceof Response) {
          const contentType = context.headers.get("content-type") || "";
          const payload = contentType.includes("application/json")
            ? await context.json().catch(() => null)
            : await context.text().catch(() => "");
          const errText = payload && typeof payload === "object" ? String((payload as any).error || "") : "";
          const detailsText = payload && typeof payload === "object" ? String((payload as any).details || "") : "";
          const serverMessage = [errText, detailsText].filter(Boolean).join(" — ") || (typeof payload === "string" ? payload : "");
          if (serverMessage) {
            throw new Error(serverMessage);
          }
        }
        throw new Error(error.message || "Analyze request failed.");
      }

      const payload = data as any;
      setResult(payload.result);
      setAnalyzeMeta({
        fallback: Boolean(payload.fallback),
        providerUsed: String(payload.provider_used || payload.provider || "unknown"),
      });

      setOriginalResumeText(String(payload.resumeText || ""));
      const { data: inserted, error: insErr } = await supabase
        .from("analyses")
        .insert({
          user_id: session.user.id,
          resume_filename: file.name,
          resume_text: payload.resumeText,
          job_description: jd,
          match_score: payload.result.match_score,
          skills_detected: payload.result.skills_detected,
          missing_keywords: payload.result.missing_keywords,
          suggestions: payload.result.suggestions,
          summary: payload.result.summary,
        })
        .select("id")
        .single();
      if (insErr) console.error(insErr);
      setAnalysisId((inserted as any)?.id ?? null);
      toast.success("Analysis complete!");
    } catch (e) {
      if (e instanceof TypeError && /fetch/i.test(e.message)) {
        toast.error("Network error. The analyze API is unreachable (often an undeployed Supabase Edge Function).");
      } else {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const generateRewrite = async () => {
    if (!originalResumeText.trim()) return toast.error("Run analysis first to extract resume text.");
    setRewriteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rewrite-resume", {
        body: {
          resumeText: originalResumeText,
          jobDescription: jd,
        },
      });
      if (error) {
        const context = (error as any)?.context;
        if (context instanceof Response) {
          const contentType = context.headers.get("content-type") || "";
          const payload = contentType.includes("application/json")
            ? await context.json().catch(() => null)
            : await context.text().catch(() => "");
          const errText = payload && typeof payload === "object" ? String((payload as any).error || "") : "";
          const detailsText = payload && typeof payload === "object" ? String((payload as any).details || "") : "";
          const serverMessage = [errText, detailsText].filter(Boolean).join(" — ") || (typeof payload === "string" ? payload : "");
          throw new Error(serverMessage || error.message || "Failed to generate rewrite.");
        }
        throw new Error(error.message || "Failed to generate rewrite.");
      }
      const rewrite = data as RewriteResult;
      setRewriteResult(rewrite);

      const { data: s } = await supabase.auth.getSession();
      const userId = s.session?.user.id;
      if (userId) {
        const { error: saveErr } = await supabase.from("rewrite_revisions").insert({
          user_id: userId,
          analysis_id: analysisId,
          original_resume_text: originalResumeText,
          rewritten_summary: rewrite.rewritten_summary,
          rewritten_experience_bullets: rewrite.rewritten_experience_bullets,
          rewritten_project_bullets: rewrite.rewritten_project_bullets,
        });
        if (saveErr) console.error(saveErr);
        else loadRewriteHistory();
      }
      toast.success("Rewrite generated.");
    } catch (e) {
      const fallbackRewrite = buildClientFallbackRewrite(originalResumeText, jd);
      setRewriteResult(fallbackRewrite);
      toast.error(e instanceof Error ? `${e.message}. Used fallback rewrite.` : "Rewrite failed. Used fallback rewrite.");
    } finally {
      setRewriteLoading(false);
    }
  };

  const callCareerTool = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!originalResumeText.trim()) throw new Error("Run analysis first to extract resume text.");
    const { data, error } = await supabase.functions.invoke("career-tools", {
      body: {
        action,
        resumeText: originalResumeText,
        jobDescription: jd,
        company,
        role,
        missingKeywords: result?.missing_keywords || [],
        ...extra,
      },
    });
    if (error) {
      const context = (error as any)?.context;
      if (context instanceof Response) {
        const contentType = context.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await context.json().catch(() => null)
          : await context.text().catch(() => "");
        const errText = payload && typeof payload === "object" ? String((payload as any).error || "") : "";
        const detailsText = payload && typeof payload === "object" ? String((payload as any).details || "") : "";
        const serverMessage =
          [errText, detailsText].filter(Boolean).join(" — ") ||
          (typeof payload === "string" ? payload : "");
        throw new Error(serverMessage || error.message || `Failed to run ${action}`);
      }
      throw new Error(error.message || `Failed to run ${action}`);
    }
    return data as any;
  };

  const generateResumeTemplate = async () => {
    try {
      setToolsLoading(true);
      const data = await callCareerTool("resume_template");
      setResumeTemplate(data);
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (uid) {
        await supabase.from("resume_versions").insert({
          user_id: uid,
          analysis_id: analysisId,
          title: "ATS Resume",
          content: JSON.stringify(data, null, 2),
        });
      }
      toast.success("ATS resume template generated.");
    } catch (e) {
      const fallback: ResumeTemplateResult = {
        headline: role || "Software Engineer",
        summary:
          "Results-driven engineer focused on building reliable, scalable, and user-centered software solutions.",
        skills: result?.skills_detected?.slice(0, 8) || [],
        experience_bullets:
          rewriteResult?.rewritten_experience_bullets?.slice(0, 6) || [
            "Delivered end-to-end features with measurable impact.",
          ],
        projects_bullets:
          rewriteResult?.rewritten_project_bullets?.slice(0, 4) || [
            "Built production-ready project components aligned to role requirements.",
          ],
        fallback: true,
        provider_used: "client-fallback",
      };
      setResumeTemplate(fallback);
      console.warn("career-tools resume_template fallback:", e);
      toast("AI service unavailable. Used fallback template.");
    } finally {
      setToolsLoading(false);
    }
  };

  const generateCoverLetter = async () => {
    try {
      setToolsLoading(true);
      const data = await callCareerTool("cover_letter");
      setCoverLetter(String(data.cover_letter || ""));
      setCoverLetterMeta({
        fallback: Boolean(data.fallback),
        provider_used: String(data.provider_used || "unknown"),
      });
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (uid) {
        await supabase.from("cover_letters").insert({
          user_id: uid,
          analysis_id: analysisId,
          company: company || null,
          role: role || null,
          content: String(data.cover_letter || ""),
        });
      }
      toast.success("Cover letter generated.");
    } catch (e) {
      const fallbackLetter =
        `Dear Hiring Manager,\n\n` +
        `I am excited to apply for the ${role || "target"} role at ${company || "your company"}. ` +
        `My background in ${result?.skills_detected?.slice(0, 3).join(", ") || "software engineering"} and shipping practical solutions aligns well with your needs.\n\n` +
        `I would welcome the opportunity to contribute and discuss how I can add value to your team.\n\nSincerely,\nCandidate`;
      setCoverLetter(fallbackLetter);
      setCoverLetterMeta({
        fallback: true,
        provider_used: "client-fallback",
      });
      console.warn("career-tools cover_letter fallback:", e);
      toast("AI service unavailable. Used fallback cover letter.");
    } finally {
      setToolsLoading(false);
    }
  };

  const generateRoadmap = async () => {
    try {
      setToolsLoading(true);
      const data = await callCareerTool("roadmap");
      setRoadmap(data);
      toast.success("30/60/90 roadmap generated.");
    } catch (e) {
      const mk = result?.missing_keywords || [];
      setRoadmap({
        days_30: [`Strengthen fundamentals for ${mk[0] || "core skills"}.`, "Build one focused mini-project."],
        days_60: [`Implement ${mk[1] || "advanced concepts"} in a portfolio project.`, "Add tests and measurable outcomes."],
        days_90: ["Run mock interviews weekly and improve weak spots.", "Ship a capstone project tailored to target roles."],
        fallback: true,
        provider_used: "client-fallback",
      });
      console.warn("career-tools roadmap fallback:", e);
      toast("AI service unavailable. Used fallback roadmap.");
    } finally {
      setToolsLoading(false);
    }
  };

  const scoreInterview = async () => {
    if (!interviewQuestion.trim() || !interviewAnswer.trim()) return toast.error("Add question and answer first.");
    try {
      setToolsLoading(true);
      const data = await callCareerTool("score_interview", {
        question: interviewQuestion,
        answer: interviewAnswer,
      });
      setInterviewScore(data);
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (uid) {
        await supabase.from("interview_attempts").insert({
          user_id: uid,
          analysis_id: analysisId,
          question: interviewQuestion,
          answer: interviewAnswer,
          scores: {
            clarity: data.clarity,
            impact: data.impact,
            technical_depth: data.technical_depth,
          },
          feedback: data.feedback,
        });
      }
      toast.success("Interview answer scored.");
    } catch (e) {
      const lengthScore = Math.min(95, Math.max(35, Math.round(interviewAnswer.length / 6)));
      setInterviewScore({
        clarity: lengthScore,
        impact: Math.max(30, lengthScore - 5),
        technical_depth: Math.max(25, lengthScore - 10),
        feedback: "Use STAR structure, add concrete metrics, and explain key technical trade-offs.",
        fallback: true,
        provider_used: "client-fallback",
      });
      console.warn("career-tools score_interview fallback:", e);
      toast("AI service unavailable. Used fallback interview scoring.");
    } finally {
      setToolsLoading(false);
    }
  };

  const saveApplication = async () => {
    if (!company.trim() || !role.trim()) return toast.error("Company and role are required.");
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return toast.error("Please sign in again.");
    const { error } = await supabase.from("applications").insert({
      user_id: uid,
      analysis_id: analysisId,
      company,
      role,
      status: "saved",
    });
    if (error) return toast.error(error.message);
    toast.success("Application saved.");
    loadApplications();
  };

  const updateApplicationStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    loadApplications();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <h1 className="text-3xl font-bold text-foreground">Analyze your resume</h1>
        <p className="text-muted-foreground mt-1">Upload your resume PDF and paste the job description.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              onPick(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              drag ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
            }`}
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-10 w-10 text-primary" />
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium text-foreground">Drop your resume PDF here</p>
                <p className="text-xs text-muted-foreground">or click to browse · max 10 MB</p>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="jd">Job description</Label>
            <Textarea
              id="jd"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              className="mt-1 min-h-[220px]"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button size="lg" onClick={analyze} disabled={loading} className="h-12 px-8">
            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</>) : "Run ATS analysis"}
          </Button>
        </div>

        {analyzeMeta && (
          <div className="mt-3 flex justify-end">
            <Badge variant={analyzeMeta.fallback ? "outline" : "secondary"}>
              {analyzeMeta.fallback
                ? `Fallback mode (${analyzeMeta.providerUsed})`
                : `AI provider: ${analyzeMeta.providerUsed}`}
            </Badge>
          </div>
        )}

        {result && (
          <Tabs defaultValue="analysis" className="mt-8">
            <TabsList>
              <TabsTrigger value="analysis">Analysis report</TabsTrigger>
              <TabsTrigger value="rewrite">Rewrite assistant</TabsTrigger>
            </TabsList>
            <TabsContent value="analysis">
              <ResultView result={result} />
            </TabsContent>
            <TabsContent value="rewrite">
              <RewriteAssistant
                rewriteLoading={rewriteLoading}
                rewriteResult={rewriteResult}
                rewriteHistory={rewriteHistory}
                onGenerate={generateRewrite}
              />
            </TabsContent>
          </Tabs>
        )}

        {result && (
          <AdvancedCareerTools
            result={result}
            company={company}
            role={role}
            setCompany={setCompany}
            setRole={setRole}
            loading={toolsLoading}
            resumeTemplate={resumeTemplate}
            coverLetter={coverLetter}
            coverLetterMeta={coverLetterMeta}
            roadmap={roadmap}
            interviewQuestion={interviewQuestion}
            setInterviewQuestion={setInterviewQuestion}
            interviewAnswer={interviewAnswer}
            setInterviewAnswer={setInterviewAnswer}
            interviewScore={interviewScore}
            applications={applications}
            onGenerateTemplate={generateResumeTemplate}
            onGenerateCoverLetter={generateCoverLetter}
            onGenerateRoadmap={generateRoadmap}
            onScoreInterview={scoreInterview}
            onSaveApplication={saveApplication}
            onUpdateApplicationStatus={updateApplicationStatus}
          />
        )}
      </main>
    </div>
  );
}

function ResultView({ result }: { result: Result }) {
  const tone =
    result.match_score >= 75 ? "text-green-600" : result.match_score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="mt-10 space-y-6">
      <div
        className="rounded-2xl border border-border bg-card p-8"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted-foreground">ATS match score</p>
            <p className={`text-5xl font-bold ${tone}`}>{result.match_score}<span className="text-2xl text-muted-foreground">/100</span></p>
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <Progress value={result.match_score} className="h-3" />
          </div>
        </div>
        <p className="mt-4 text-foreground">{result.summary}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Skills detected" icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}>
          <div className="flex flex-wrap gap-2">
            {result.skills_detected.length === 0 && <span className="text-sm text-muted-foreground">None detected.</span>}
            {result.skills_detected.map((s) => (
              <Badge key={s} variant="secondary">{s}</Badge>
            ))}
          </div>
        </Card>
        <Card title="Missing keywords" icon={<AlertCircle className="h-5 w-5 text-amber-600" />}>
          <div className="flex flex-wrap gap-2">
            {result.missing_keywords.length === 0 && <span className="text-sm text-muted-foreground">Nothing critical missing 🎉</span>}
            {result.missing_keywords.map((s) => (
              <Badge key={s} variant="outline">{s}</Badge>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Improvement suggestions" icon={<Lightbulb className="h-5 w-5 text-primary" />}>
        <ul className="space-y-3">
          {result.suggestions.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-foreground">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Technical interview questions" icon={<CheckCircle2 className="h-5 w-5 text-primary" />}>
          <ul className="space-y-3">
            {(result.technical_questions || []).map((q, i) => (
              <li key={i} className="text-sm text-foreground">{i + 1}. {q}</li>
            ))}
          </ul>
        </Card>

        <Card title="Behavioral interview questions" icon={<AlertCircle className="h-5 w-5 text-primary" />}>
          <ul className="space-y-3">
            {(result.behavioral_questions || []).map((q, i) => (
              <li key={i} className="text-sm text-foreground">{i + 1}. {q}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function RewriteAssistant({
  rewriteLoading,
  rewriteResult,
  rewriteHistory,
  onGenerate,
}: {
  rewriteLoading: boolean;
  rewriteResult: RewriteResult | null;
  rewriteHistory: RewriteHistoryRow[];
  onGenerate: () => Promise<void>;
}) {
  const buildExportText = (data: RewriteResult) => {
    const exp = data.rewritten_experience_bullets
      .map((b, i) => `${i + 1}. ${b}`)
      .join("\n");
    const proj = data.rewritten_project_bullets
      .map((b, i) => `${i + 1}. ${b}`)
      .join("\n");
    return [
      "RESUME REWRITE",
      "",
      "SUMMARY",
      data.rewritten_summary || "",
      "",
      "EXPERIENCE BULLETS",
      exp || "No generated experience bullets.",
      "",
      "PROJECT BULLETS",
      proj || "No generated project bullets.",
      "",
      `Source: ${data.fallback ? "Fallback mode" : `AI provider (${data.provider_used})`}`,
    ].join("\n");
  };

  const buildExportMarkdown = (data: RewriteResult) => {
    const exp = data.rewritten_experience_bullets
      .map((b) => `- ${b}`)
      .join("\n");
    const proj = data.rewritten_project_bullets
      .map((b) => `- ${b}`)
      .join("\n");
    return [
      "# Resume Rewrite",
      "",
      "## Summary",
      data.rewritten_summary || "",
      "",
      "## Experience Bullets",
      exp || "- No generated experience bullets.",
      "",
      "## Project Bullets",
      proj || "- No generated project bullets.",
      "",
      `> Source: ${data.fallback ? "Fallback mode" : `AI provider (${data.provider_used})`}`,
    ].join("\n");
  };

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const buildExportHtml = (data: RewriteResult) => {
    const exp = data.rewritten_experience_bullets
      .map((b) => `<li>${escapeHtml(b)}</li>`)
      .join("");
    const proj = data.rewritten_project_bullets
      .map((b) => `<li>${escapeHtml(b)}</li>`)
      .join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Resume Rewrite</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.55; margin: 40px; color: #111; }
      h1 { margin-bottom: 8px; }
      h2 { margin-top: 28px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
      ul { margin-top: 8px; }
      li { margin-bottom: 8px; }
      .meta { margin-top: 24px; color: #555; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>Resume Rewrite</h1>
    <h2>Summary</h2>
    <p>${escapeHtml(data.rewritten_summary || "")}</p>

    <h2>Experience Bullets</h2>
    <ul>${exp || "<li>No generated experience bullets.</li>"}</ul>

    <h2>Project Bullets</h2>
    <ul>${proj || "<li>No generated project bullets.</li>"}</ul>

    <p class="meta">Source: ${escapeHtml(data.fallback ? "Fallback mode" : `AI provider (${data.provider_used})`)}</p>
  </body>
</html>`;
  };

  const copyAll = async () => {
    if (!rewriteResult) return;
    try {
      await navigator.clipboard.writeText(buildExportText(rewriteResult));
      toast.success("Rewritten content copied.");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const exportTxt = () => {
    if (!rewriteResult) return;
    const blob = new Blob([buildExportText(rewriteResult)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-rewrite.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    if (!rewriteResult) return;
    const blob = new Blob([buildExportMarkdown(rewriteResult)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-rewrite.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportWordDoc = () => {
    if (!rewriteResult) return;
    const html = buildExportHtml(rewriteResult);
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-rewrite.doc";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openPrintView = () => {
    if (!rewriteResult) return;
    const html = buildExportHtml(rewriteResult);
    const w = window.open("", "_blank");
    if (!w) return toast.error("Popup blocked. Allow popups to open print view.");
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={copyAll} disabled={!rewriteResult || rewriteLoading}>
          Copy all
        </Button>
        <Button variant="outline" onClick={exportTxt} disabled={!rewriteResult || rewriteLoading}>
          Export .txt
        </Button>
        <Button variant="outline" onClick={exportMarkdown} disabled={!rewriteResult || rewriteLoading}>
          Export .md
        </Button>
        <Button variant="outline" onClick={exportWordDoc} disabled={!rewriteResult || rewriteLoading}>
          Export Word
        </Button>
        <Button variant="outline" onClick={openPrintView} disabled={!rewriteResult || rewriteLoading}>
          Save as PDF
        </Button>
        <Button onClick={onGenerate} disabled={rewriteLoading}>
          {rewriteLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>) : "Generate rewrite"}
        </Button>
      </div>

      {rewriteResult && (
        <Card title="Rewritten summary" icon={<Lightbulb className="h-5 w-5 text-primary" />}>
          <p className="text-sm text-foreground whitespace-pre-wrap">{rewriteResult.rewritten_summary}</p>
          <div className="mt-4">
            <Badge variant={rewriteResult.fallback ? "outline" : "secondary"}>
              {rewriteResult.fallback ? "Fallback rewrite" : `Provider: ${rewriteResult.provider_used}`}
            </Badge>
          </div>
        </Card>
      )}

      {rewriteResult && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Rewritten experience bullets" icon={<CheckCircle2 className="h-5 w-5 text-primary" />}>
            <ul className="space-y-2">
              {rewriteResult.rewritten_experience_bullets.map((b, i) => (
                <li key={i} className="text-sm text-foreground">{i + 1}. {b}</li>
              ))}
            </ul>
          </Card>
          <Card title="Rewritten project bullets" icon={<CheckCircle2 className="h-5 w-5 text-primary" />}>
            <ul className="space-y-2">
              {rewriteResult.rewritten_project_bullets.map((b, i) => (
                <li key={i} className="text-sm text-foreground">{i + 1}. {b}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Card title="Recent rewrite history" icon={<FileText className="h-5 w-5 text-primary" />}>
        {rewriteHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rewrites saved yet.</p>
        ) : (
          <ul className="space-y-3">
            {rewriteHistory.map((h) => (
              <li key={h.id} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                <p className="text-sm text-foreground mt-1 line-clamp-3">{h.rewritten_summary}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AdvancedCareerTools({
  result,
  company,
  role,
  setCompany,
  setRole,
  loading,
  resumeTemplate,
  coverLetter,
  coverLetterMeta,
  roadmap,
  interviewQuestion,
  setInterviewQuestion,
  interviewAnswer,
  setInterviewAnswer,
  interviewScore,
  applications,
  onGenerateTemplate,
  onGenerateCoverLetter,
  onGenerateRoadmap,
  onScoreInterview,
  onSaveApplication,
  onUpdateApplicationStatus,
}: {
  result: Result;
  company: string;
  role: string;
  setCompany: (v: string) => void;
  setRole: (v: string) => void;
  loading: boolean;
  resumeTemplate: ResumeTemplateResult | null;
  coverLetter: string;
  coverLetterMeta: SourceMeta | null;
  roadmap: RoadmapResult | null;
  interviewQuestion: string;
  setInterviewQuestion: (v: string) => void;
  interviewAnswer: string;
  setInterviewAnswer: (v: string) => void;
  interviewScore: InterviewScoreResult | null;
  applications: ApplicationRow[];
  onGenerateTemplate: () => Promise<void>;
  onGenerateCoverLetter: () => Promise<void>;
  onGenerateRoadmap: () => Promise<void>;
  onScoreInterview: () => Promise<void>;
  onSaveApplication: () => Promise<void>;
  onUpdateApplicationStatus: (id: string, status: string) => Promise<void>;
}) {
  const rubric = {
    keywords: Math.min(100, result.match_score),
    impact: Math.min(100, 40 + result.suggestions.length * 10),
    clarity: Math.min(100, 45 + Math.min(result.summary.length, 300) / 6),
    role_alignment: Math.min(100, 40 + result.skills_detected.length * 8),
  };

  return (
    <div className="mt-10 space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">Advanced Career Tools</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Apply to ATS resume template" icon={<FileText className="h-5 w-5 text-primary" />}>
          <Button onClick={onGenerateTemplate} disabled={loading}>Generate template</Button>
          {resumeTemplate && (
            <div className="mt-3">
              <Badge variant={resumeTemplate.fallback ? "outline" : "secondary"}>
                {resumeTemplate.fallback ? "Fallback" : `AI: ${resumeTemplate.provider_used}`}
              </Badge>
            </div>
          )}
          {resumeTemplate && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">{resumeTemplate.headline}</p>
              <p className="text-sm text-muted-foreground">{resumeTemplate.summary}</p>
              <div className="flex flex-wrap gap-2">
                {resumeTemplate.skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
              </div>
            </div>
          )}
        </Card>

        <Card title="Cover letter generator" icon={<Lightbulb className="h-5 w-5 text-primary" />}>
          <div className="space-y-2">
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <Button onClick={onGenerateCoverLetter} disabled={loading}>Generate cover letter</Button>
            {coverLetterMeta && (
              <Badge variant={coverLetterMeta.fallback ? "outline" : "secondary"}>
                {coverLetterMeta.fallback ? "Fallback" : `AI: ${coverLetterMeta.provider_used}`}
              </Badge>
            )}
            {coverLetter && <Textarea value={coverLetter} readOnly className="min-h-[180px]" />}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Skill-gap roadmap (30/60/90)" icon={<CheckCircle2 className="h-5 w-5 text-primary" />}>
          <Button onClick={onGenerateRoadmap} disabled={loading}>Generate roadmap</Button>
          {roadmap && (
            <div className="mt-3">
              <Badge variant={roadmap.fallback ? "outline" : "secondary"}>
                {roadmap.fallback ? "Fallback" : `AI: ${roadmap.provider_used}`}
              </Badge>
            </div>
          )}
          {roadmap && (
            <div className="mt-4 space-y-3 text-sm">
              <p className="font-medium">30 days</p><ul className="list-disc pl-5">{roadmap.days_30.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <p className="font-medium">60 days</p><ul className="list-disc pl-5">{roadmap.days_60.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <p className="font-medium">90 days</p><ul className="list-disc pl-5">{roadmap.days_90.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
        </Card>

        <Card title="Interview mode with scoring" icon={<AlertCircle className="h-5 w-5 text-primary" />}>
          <div className="space-y-2">
            <Textarea value={interviewQuestion} onChange={(e) => setInterviewQuestion(e.target.value)} placeholder="Question" className="min-h-[80px]" />
            <Textarea value={interviewAnswer} onChange={(e) => setInterviewAnswer(e.target.value)} placeholder="Your answer" className="min-h-[120px]" />
            <Button onClick={onScoreInterview} disabled={loading}>Score answer</Button>
            {interviewScore && (
              <Badge variant={interviewScore.fallback ? "outline" : "secondary"}>
                {interviewScore.fallback ? "Fallback" : `AI: ${interviewScore.provider_used}`}
              </Badge>
            )}
            {interviewScore && (
              <div className="text-sm space-y-1">
                <p>Clarity: <strong>{interviewScore.clarity}</strong></p>
                <p>Impact: <strong>{interviewScore.impact}</strong></p>
                <p>Technical depth: <strong>{interviewScore.technical_depth}</strong></p>
                <p className="text-muted-foreground">{interviewScore.feedback}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Application tracker" icon={<FileText className="h-5 w-5 text-primary" />}>
          <div className="space-y-2">
            <Button onClick={onSaveApplication}>Save application</Button>
            <ul className="space-y-2 text-sm">
              {applications.map((a) => (
                <li key={a.id} className="rounded border border-border p-2">
                  <p className="font-medium">{a.company} - {a.role}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-muted-foreground">{a.status}</span>
                    <Button variant="outline" size="sm" onClick={() => onUpdateApplicationStatus(a.id, "applied")}>Applied</Button>
                    <Button variant="outline" size="sm" onClick={() => onUpdateApplicationStatus(a.id, "interview")}>Interview</Button>
                    <Button variant="outline" size="sm" onClick={() => onUpdateApplicationStatus(a.id, "offer")}>Offer</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Quality scoring rubric panel" icon={<CheckCircle2 className="h-5 w-5 text-primary" />}>
          <div className="space-y-2 text-sm">
            <p>Keywords: <strong>{Math.round(rubric.keywords)}</strong>/100</p>
            <Progress value={rubric.keywords} className="h-2" />
            <p>Impact metrics: <strong>{Math.round(rubric.impact)}</strong>/100</p>
            <Progress value={rubric.impact} className="h-2" />
            <p>Clarity: <strong>{Math.round(rubric.clarity)}</strong>/100</p>
            <Progress value={rubric.clarity} className="h-2" />
            <p>Role alignment: <strong>{Math.round(rubric.role_alignment)}</strong>/100</p>
            <Progress value={rubric.role_alignment} className="h-2" />
          </div>
        </Card>
      </div>
    </div>
  );
}
