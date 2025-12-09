import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Calendar, Tag, TrendingUp } from "lucide-react";

interface PublicationStats {
  total: number;
  today: number;
  last7Days: number;
  uniqueTerms: number;
  uniqueGazettes: number;
}

export function PublicationsStats() {
  const [stats, setStats] = useState<PublicationStats>({
    total: 0,
    today: 0,
    last7Days: 0,
    uniqueTerms: 0,
    uniqueGazettes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);
      last7Days.setHours(0, 0, 0, 0);

      // Total count
      const { count: total } = await supabase
        .from("publications")
        .select("*", { count: "exact", head: true });

      // Today's count
      const { count: todayCount } = await supabase
        .from("publications")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());

      // Last 7 days count
      const { count: last7DaysCount } = await supabase
        .from("publications")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last7Days.toISOString());

      // Get unique gazettes
      const { data: gazetteData } = await supabase
        .from("publications")
        .select("gazette_name")
        .not("gazette_name", "is", null);
      
      const uniqueGazettes = new Set(gazetteData?.map(g => g.gazette_name)).size;

      // Get unique matched terms
      const { data: termsData } = await supabase
        .from("publications")
        .select("matched_terms")
        .not("matched_terms", "is", null);
      
      const allTerms = termsData?.flatMap(t => t.matched_terms || []) || [];
      const uniqueTerms = new Set(allTerms).size;

      setStats({
        total: total || 0,
        today: todayCount || 0,
        last7Days: last7DaysCount || 0,
        uniqueTerms,
        uniqueGazettes,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-8 bg-muted rounded w-16 mb-2"></div>
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total de Publicações</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{stats.today.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Hoje</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-2xl font-bold">{stats.last7Days.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Últimos 7 dias</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-500" />
            <div>
              <div className="text-2xl font-bold">{stats.uniqueTerms.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Termos Únicos</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
