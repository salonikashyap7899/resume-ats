import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FilePlus2, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — ResumeATS" }] }),
});

type Row = {
  id: string;
  resume_filename: string;
  match_score: number;
  summary: string | null;
  created_at: string;
  missing_keywords: string[];
};

function Dashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { navigate({ to: "/auth" }); return; }
    const { data, error } = await supabase
      .from("analyses")
      .select("id, resume_filename, match_score, summary, created_at, missing_keywords")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data as unknown as Row[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    toast.success("Deleted");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your analyses</h1>
            <p className="text-muted-foreground mt-1">Past resume reports and ATS scores.</p>
          </div>
          <Link to="/analyze">
            <Button><FilePlus2 className="mr-2 h-4 w-4" /> New analysis</Button>
          </Link>
        </div>

        <div className="mt-8">
          {rows === null ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-foreground font-medium">No analyses yet</p>
              <p className="text-sm text-muted-foreground mt-1">Run your first ATS analysis to see it here.</p>
              <Link to="/analyze"><Button className="mt-4">Analyze a resume</Button></Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4 flex-wrap"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <ScoreBadge score={r.match_score} />
                      <p className="font-medium text-foreground truncate">{r.resume_filename}</p>
                    </div>
                    {r.summary && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.summary}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                      {r.missing_keywords?.slice(0, 4).map((k) => (
                        <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? "bg-green-100 text-green-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`inline-flex h-9 w-12 items-center justify-center rounded-md text-sm font-semibold ${cls}`}>{score}</span>;
}
