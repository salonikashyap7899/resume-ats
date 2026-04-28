import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, CheckCircle2, Sparkles, Target, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ResumeATS — AI Resume Analyzer & ATS Score" },
      { name: "description", content: "Upload your resume and a job description to get an instant ATS match score, missing keywords, and AI-powered improvement suggestions." },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // stay on landing; just preconnect
      void data;
    });
  }, [navigate]);

  return (
    <div className="bg-background">
      <Header />
      <main>
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{ background: "var(--gradient-hero)" }}
            aria-hidden
          />
          <div className="container mx-auto px-4 py-24 md:py-32 relative">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI-powered ATS analysis
              </div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
                Beat the bots.{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "var(--gradient-primary)" }}
                >
                  Land the interview.
                </span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Upload your resume and any job description. Get an instant ATS match score,
                missing keywords, and concrete suggestions to make your resume unmissable.
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Link to="/analyze">
                  <Button size="lg" className="h-12 px-6">
                    Analyze my resume <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="h-12 px-6">
                    Create free account
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-20 grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
              {[
                { icon: Target, title: "ATS match score", desc: "0–100 score showing how well your resume aligns with the job." },
                { icon: Zap, title: "Missing keywords", desc: "Spot the exact skills and terms recruiters' systems look for." },
                { icon: CheckCircle2, title: "Actionable rewrites", desc: "Concrete, line-level suggestions to strengthen your resume." },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border bg-card p-6"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground mb-4"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
