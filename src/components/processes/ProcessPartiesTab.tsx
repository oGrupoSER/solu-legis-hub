import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, User, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Party {
  id: string;
  nome: string;
  tipo_polo: number;
  cpf: string | null;
  cnpj: string | null;
  tipo_pessoa: string | null;
}

interface Lawyer {
  id: string;
  nome_advogado: string;
  num_oab: string | null;
  uf_oab: string | null;
  cod_processo_polo: number | null;
}

interface ProcessPartiesTabProps {
  processId: string;
}

const poloLabels: Record<number, string> = {
  1: "Polo Ativo",
  2: "Polo Passivo",
  3: "Terceiro",
};

export function ProcessPartiesTab({ processId }: ProcessPartiesTabProps) {
  const [parties, setParties] = useState<Party[]>([]);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [processId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [partiesRes, lawyersRes] = await Promise.all([
        supabase
          .from("process_parties")
          .select("*")
          .eq("process_id", processId)
          .order("tipo_polo"),
        supabase
          .from("process_lawyers")
          .select("*")
          .eq("process_id", processId),
      ]);

      if (partiesRes.error) throw partiesRes.error;
      if (lawyersRes.error) throw lawyersRes.error;

      setParties(partiesRes.data || []);
      setLawyers(lawyersRes.data || []);
    } catch (error) {
      console.error("Error fetching parties:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse text-center">Carregando partes...</div>
        </CardContent>
      </Card>
    );
  }

  const activeParties = parties.filter(p => p.tipo_polo === 1);
  const passiveParties = parties.filter(p => p.tipo_polo === 2);
  const otherParties = parties.filter(p => p.tipo_polo !== 1 && p.tipo_polo !== 2);

  const renderPartyCard = (party: Party) => {
    // Match lawyers by cod_processo_polo (same as party)
    const partyLawyers = lawyers.filter(l => 
      l.cod_processo_polo === (party as any).cod_processo_polo
    );
    
    return (
      <div key={party.id} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{party.nome}</span>
          </div>
          <Badge variant="outline">
            {party.tipo_pessoa || "Pessoa"}
          </Badge>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-1">
          {party.cpf && <p>CPF: {party.cpf}</p>}
          {party.cnpj && <p>CNPJ: {party.cnpj}</p>}
        </div>

        {partyLawyers.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Advogados
            </p>
            {partyLawyers.map(lawyer => (
              <div key={lawyer.id} className="text-sm pl-4">
                <p>{lawyer.nome_advogado}</p>
                {lawyer.num_oab && (
                  <p className="text-xs text-muted-foreground">
                    OAB: {lawyer.num_oab}{lawyer.uf_oab ? `/${lawyer.uf_oab}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (parties.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Nenhuma parte encontrada para este processo
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {activeParties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Users className="h-5 w-5" />
              Polo Ativo ({activeParties.length})
            </CardTitle>
            <CardDescription>Autores / Requerentes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {activeParties.map(renderPartyCard)}
            </div>
          </CardContent>
        </Card>
      )}

      {passiveParties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Users className="h-5 w-5" />
              Polo Passivo ({passiveParties.length})
            </CardTitle>
            <CardDescription>Réus / Requeridos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {passiveParties.map(renderPartyCard)}
            </div>
          </CardContent>
        </Card>
      )}

      {otherParties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Outros ({otherParties.length})
            </CardTitle>
            <CardDescription>Terceiros interessados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {otherParties.map(renderPartyCard)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
