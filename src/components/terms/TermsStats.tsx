import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, CheckCircle, Search } from "lucide-react";

export const TermsStats = () => {
  const [stats, setStats] = useState<any[]>([]);
  const [totals, setTotals] = useState({ 
    total: 0, 
    active: 0, 
    withMatches: 0,
    offices: 0,
    names: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get all terms
      const { data: terms, error } = await supabase
        .from("search_terms")
        .select("id, term, term_type, is_active");

      if (error) throw error;

      // Get publications with matched terms
      const { data: publications } = await supabase
        .from("publications")
        .select("matched_terms")
        .not("matched_terms", "is", null);

      // Count matches per term
      const matchCounts = new Map<string, number>();
      publications?.forEach((pub) => {
        pub.matched_terms?.forEach((term: string) => {
          matchCounts.set(term, (matchCounts.get(term) || 0) + 1);
        });
      });

      // Build stats
      const termStats = terms?.map((term) => ({
        term: term.term,
        matches: matchCounts.get(term.term) || 0,
        type: term.term_type,
      })) || [];

      setStats(termStats.sort((a, b) => b.matches - a.matches).slice(0, 10));

      setTotals({
        total: terms?.length || 0,
        active: terms?.filter((t) => t.is_active).length || 0,
        withMatches: termStats.filter((t) => t.matches > 0).length,
        offices: terms?.filter((t) => t.term_type === 'office').length || 0,
        names: terms?.filter((t) => t.term_type === 'name').length || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-5 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Termos</CardTitle>
          <Search className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totals.total}</div>
          <p className="text-xs text-muted-foreground">{totals.active} ativos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Escritórios</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totals.offices}</div>
          <p className="text-xs text-muted-foreground">Cadastrados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Nomes</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totals.names}</div>
          <p className="text-xs text-muted-foreground">De pesquisa</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Com Resultados</CardTitle>
          <CheckCircle className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totals.withMatches}</div>
          <p className="text-xs text-muted-foreground">Termos com publicações</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Termo</CardTitle>
          <FileText className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats[0]?.matches || 0}</div>
          <p className="text-xs text-muted-foreground truncate">
            {stats[0]?.term || "Nenhum"}
          </p>
        </CardContent>
      </Card>

      {stats.length > 0 && (
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle>Top 10 Termos por Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="term" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="matches" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
