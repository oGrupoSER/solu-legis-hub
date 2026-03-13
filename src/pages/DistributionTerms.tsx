import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, Loader2, Download, RefreshCw, CheckCircle2, AlertCircle, Clock, Link2, Trash2, PlusCircle, Edit } from "lucide-react";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { ClientBadges } from "@/components/shared/ClientBadges";
import { ClientSelector } from "@/components/shared/ClientSelector";
import { BulkClientLinkDialog } from "@/components/shared/BulkClientLinkDialog";

interface DistributionTerm {
  id: string;
  term: string;
  term_type: string;
  is_active: boolean;
  created_at: string;
  solucionare_code: number | null;
  solucionare_status: string;
  metadata: any;
  partners?: { name: string };
  partner_services?: { service_name: string; id: string };
  client_search_terms?: { client_systems: { id: string; name: string } }[];
}

interface DocumentoEntry {
  dadoDocumento: string;
  tipoDocumento: number;
}

interface OabEntry {
  uf: string;
  numOab: string;
}

interface TermFormData {
  nome: string;
  codTipoConsulta: string;
  qtdDiasCapturaRetroativa: string;
  listInstancias: number[];
  listDocumentos: DocumentoEntry[];
  listOab: OabEntry[];
}

const TIPO_CONSULTA_OPTIONS = [
  { value: "1", label: "Pessoa Física ou Jurídica" },
  { value: "2", label: "Advogado" },
  { value: "3", label: "Assunto" },
  { value: "4", label: "Classe Processual" },
  { value: "5", label: "Documento de PF ou PJ" },
  { value: "6", label: "OAB de Advogado" },
];

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const FIXED_ABRANGENCIAS = [
  "CJM-1","CJM-10","CJM-11","CJM-12","CJM-2","CJM-3","CJM-4","CJM-5","CJM-6","CJM-7","CJM-8","CJM-9",
  "JF-AC","JF-AL","JF-AM","JF-AP","JF-BA","JF-CE","JF-DF","JF-ES","JF-GO","JF-MA","JF-MG","JF-MS","JF-MT",
  "JF-PA","JF-PB","JF-PE","JF-PI","JF-PR","JF-RJ","JF-RN","JF-RO","JF-RR","JF-RS","JF-SC","JF-SE","JF-SP","JF-TO",
  "STF","STJ",
  "TJ-AC","TJ-AL","TJ-AM","TJ-AP","TJ-BA","TJ-CE","TJ-DF","TJ-DFT","TJ-ES","TJ-GO","TJ-MA","TJ-MG",
  "TJM-MG","TJM-RS","TJ-MS","TJM-SP","TJ-MT","TJ-PA","TJ-PB","TJ-PE","TJ-PI","TJ-PR","TJ-RJ","TJ-RN","TJ-RO","TJ-RR",
  "TJ-RS","TJ-SC","TJ-SE","TJ-SP","TJ-TO",
  "TRE-AC","TRE-AL","TRE-AM","TRE-AP","TRE-BA","TRE-CE","TRE-DF","TRE-DFT","TRE-ES","TRE-GO","TRE-MA","TRE-MG",
  "TRE-MS","TRE-MT","TRE-PA","TRE-PB","TRE-PE","TRE-PI","TRE-PR","TRE-RJ","TRE-RN","TRE-RO","TRE-RR","TRE-RS",
  "TRE-SC","TRE-SE","TRE-SP","TRE-TO",
  "TRF-1","TRF-2","TRF-3","TRF-4","TRF-5","TRF-6",
  "TRT-1","TRT-10","TRT-11","TRT-12","TRT-13","TRT-14","TRT-15","TRT-16","TRT-17","TRT-18","TRT-19",
  "TRT-2","TRT-20","TRT-21","TRT-22","TRT-23","TRT-24",
  "TRT-3","TRT-4","TRT-5","TRT-6","TRT-7","TRT-8","TRT-9",
  "TSE","TST",
];

const DEFAULT_FORM: TermFormData = {
  nome: "",
  codTipoConsulta: "1",
  qtdDiasCapturaRetroativa: "90",
  listInstancias: [4],
  listDocumentos: [],
  listOab: [],
};

// ──────────────────────────────────────────────
// Tab 1: Dados Básicos
// ──────────────────────────────────────────────
function DadosBasicosTab({
  form, setForm, selectedService, setSelectedService, services,
  selectedClients, setSelectedClients, clientError, setClientError,
}: {
  form: TermFormData; setForm: (f: TermFormData) => void;
  selectedService: string; setSelectedService: (s: string) => void;
  services: { id: string; service_name: string }[] | undefined;
  selectedClients: string[]; setSelectedClients: (ids: string[]) => void;
  clientError: boolean; setClientError: (b: boolean) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Serviço de Distribuições *</Label>
        <Select value={selectedService} onValueChange={setSelectedService}>
          <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
          <SelectContent>
            {services?.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Nome para Monitorar *</Label>
        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: João da Silva" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Consulta *</Label>
          <Select value={form.codTipoConsulta} onValueChange={(v) => setForm({ ...form, codTipoConsulta: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPO_CONSULTA_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Dias de Captura Retroativa</Label>
          <Input
            type="number"
            min="0"
            value={form.qtdDiasCapturaRetroativa}
            onChange={(e) => setForm({ ...form, qtdDiasCapturaRetroativa: e.target.value })}
            placeholder="90"
          />
        </div>
      </div>

      {/* Instâncias - locked to "Todas as Instâncias" */}
      <div className="space-y-2">
        <Label>Instâncias</Label>
        <div className="p-2 border rounded-md bg-muted/30">
          <label className="flex items-center gap-2 cursor-not-allowed opacity-80">
            <Checkbox checked={true} disabled />
            <span className="text-sm">Todas as Instâncias</span>
          </label>
        </div>
      </div>

      <ClientSelector
        serviceId={selectedService || undefined}
        selectedIds={selectedClients}
        onChange={(ids) => { setSelectedClients(ids); setClientError(false); }}
        error={clientError}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab 2: Documentos e OAB
// ──────────────────────────────────────────────
function DocumentosOabTab({
  form, setForm,
}: {
  form: TermFormData; setForm: (f: TermFormData) => void;
}) {
  const addDocumento = () => {
    setForm({ ...form, listDocumentos: [...form.listDocumentos, { dadoDocumento: "", tipoDocumento: 2 }] });
  };
  const removeDocumento = (idx: number) => {
    setForm({ ...form, listDocumentos: form.listDocumentos.filter((_, i) => i !== idx) });
  };
  const updateDocumento = (idx: number, field: keyof DocumentoEntry, value: any) => {
    const updated = [...form.listDocumentos];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, listDocumentos: updated });
  };

  const addOab = () => {
    setForm({ ...form, listOab: [...form.listOab, { uf: "SP", numOab: "" }] });
  };
  const removeOab = (idx: number) => {
    setForm({ ...form, listOab: form.listOab.filter((_, i) => i !== idx) });
  };
  const updateOab = (idx: number, field: keyof OabEntry, value: string) => {
    const updated = [...form.listOab];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, listOab: updated });
  };

  return (
    <div className="space-y-6 py-2">
      {/* Documentos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Documentos (CPF/CNPJ)</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Opcional. Melhora a assertividade da busca.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addDocumento} className="gap-1">
            <PlusCircle className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {form.listDocumentos.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Nenhum documento adicionado.</p>
        )}

        {form.listDocumentos.map((doc, idx) => (
          <div key={idx} className="flex items-end gap-2 p-3 border rounded-md bg-muted/30">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Documento</Label>
              <Input
                value={doc.dadoDocumento}
                onChange={(e) => updateDocumento(idx, "dadoDocumento", e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="w-[140px] space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={String(doc.tipoDocumento)}
                onValueChange={(v) => updateDocumento(idx, "tipoDocumento", parseInt(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">CPF</SelectItem>
                  <SelectItem value="1">CNPJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeDocumento(idx)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* OABs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">OAB</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Opcional. Melhora a assertividade da busca.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addOab} className="gap-1">
            <PlusCircle className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {form.listOab.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Nenhuma OAB adicionada.</p>
        )}

        {form.listOab.map((oab, idx) => (
          <div key={idx} className="flex items-end gap-2 p-3 border rounded-md bg-muted/30">
            <div className="w-[100px] space-y-1">
              <Label className="text-xs">UF</Label>
              <Select value={oab.uf} onValueChange={(v) => updateOab(idx, "uf", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UF_OPTIONS.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Número da OAB</Label>
              <Input
                value={oab.numOab}
                onChange={(e) => updateOab(idx, "numOab", e.target.value)}
                placeholder="123456"
              />
            </div>
            <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeOab(idx)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Tab 3: Abrangências (locked)
// ──────────────────────────────────────────────
function AbrangenciasTab() {
  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between">
        <Label>Abrangências (Diários)</Label>
        <Badge variant="secondary">{FIXED_ABRANGENCIAS.length} diários selecionados</Badge>
      </div>

      <div className="p-3 border rounded-md bg-muted/30">
        <label className="flex items-center gap-2 cursor-not-allowed opacity-80">
          <Checkbox checked={true} disabled />
          <span className="text-sm font-medium">Todos os diários selecionados</span>
        </label>
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          Todas as {FIXED_ABRANGENCIAS.length} abrangências serão enviadas automaticamente.
        </p>
      </div>

      <ScrollArea className="h-[240px] border rounded-md p-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {FIXED_ABRANGENCIAS.map((sigla) => (
            <label key={sigla} className="flex items-center gap-2 py-1 px-2 text-sm cursor-not-allowed opacity-70 rounded">
              <Checkbox checked={true} disabled />
              <span className="font-mono text-xs">{sigla}</span>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Distribution Term Dialog (Wizard with Tabs)
// ──────────────────────────────────────────────
function DistributionTermDialog({
  open, onOpenChange, services, editTerm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: { id: string; service_name: string }[] | undefined;
  editTerm?: DistributionTerm | null;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!editTerm;

  const [selectedService, setSelectedService] = useState<string>("");
  const [form, setForm] = useState<TermFormData>({ ...DEFAULT_FORM });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientError, setClientError] = useState(false);
  const [activeTab, setActiveTab] = useState("basics");

  // Auto-select first service
  useEffect(() => {
    if (!selectedService && services && services.length > 0 && !isEditing) {
      setSelectedService(services[0].id);
    }
  }, [services, selectedService, isEditing]);

  // Auto-select all clients when service changes (for new terms)
  const { data: entitledClients } = useQuery({
    queryKey: ["entitled-clients-for-service", selectedService],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_system_services")
        .select("client_systems(id, name)")
        .eq("partner_service_id", selectedService)
        .eq("is_active", true);
      return (data || []).map((item: any) => item.client_systems).filter(Boolean);
    },
    enabled: !!selectedService,
  });

  useEffect(() => {
    if (!isEditing && entitledClients && entitledClients.length > 0 && selectedClients.length === 0) {
      setSelectedClients(entitledClients.map((c: any) => c.id));
    }
  }, [entitledClients, isEditing]);

  // Populate form when editing
  const populateEdit = () => {
    if (!editTerm) return;
    const meta = editTerm.metadata || {};
    setForm({
      nome: editTerm.term,
      codTipoConsulta: String(meta.codTipoConsulta || "1"),
      qtdDiasCapturaRetroativa: meta.qtdDiasCapturaRetroativa ? String(meta.qtdDiasCapturaRetroativa) : "90",
      listInstancias: [4],
      listDocumentos: meta.listDocumentos || [],
      listOab: meta.listOab || [],
    });
    setSelectedService(editTerm.partner_services?.id || "");
    const clientIds = editTerm.client_search_terms?.map((c: any) => c.client_systems?.id).filter(Boolean) || [];
    setSelectedClients(clientIds);
    setActiveTab("basics");
  };

  // Populate form when editTerm changes
  useEffect(() => {
    if (editTerm && open) {
      populateEdit();
    }
  }, [editTerm, open]);

  // Reset on open/close
  const handleOpenChange = (o: boolean) => {
    if (o && editTerm) {
      populateEdit();
    } else if (o) {
      setForm({ ...DEFAULT_FORM });
      setSelectedClients([]);
      setSelectedService(services && services.length > 0 ? services[0].id : "");
      setClientError(false);
      setActiveTab("basics");
    }
    onOpenChange(o);
  };

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedService) throw new Error("Selecione um serviço");
      if (!form.nome.trim()) throw new Error("Digite um nome");
      if (selectedClients.length === 0) throw new Error("Selecione ao menos um cliente");

      const body: any = {
        action: isEditing ? "editName" : "registerName",
        serviceId: selectedService,
        nome: form.nome,
        codTipoConsulta: parseInt(form.codTipoConsulta),
        listInstancias: [4],
        abrangencias: FIXED_ABRANGENCIAS,
        clientIds: selectedClients,
      };

      if (form.qtdDiasCapturaRetroativa) {
        body.qtdDiasCapturaRetroativa = parseInt(form.qtdDiasCapturaRetroativa);
      }
      if (form.listDocumentos.length > 0) {
        body.listDocumentos = form.listDocumentos.filter(d => d.dadoDocumento.trim());
      }
      if (form.listOab.length > 0) {
        body.listOab = form.listOab.filter(o => o.numOab.trim());
      }

      if (isEditing) {
        body.termId = editTerm!.id;
        body.codNome = editTerm!.solucionare_code;
      }

      const { data, error } = await supabase.functions.invoke("manage-distribution-terms", { body });
      if (error) {
        const errStr = error.message || String(error);
        const jsonMatch = errStr.match(/\{.*"error"\s*:\s*"([^"]+)".*\}/);
        if (jsonMatch?.[1]) {
          throw new Error(jsonMatch[1]);
        }
        throw error;
      }
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      // Link clients
      const termId = isEditing ? editTerm!.id : data?.data?.local?.id;
      if (termId) {
        await supabase.from("client_search_terms").delete().eq("search_term_id", termId);
        const links = selectedClients.map((clientId) => ({
          search_term_id: termId,
          client_system_id: clientId,
        }));
        if (links.length > 0) await supabase.from("client_search_terms").insert(links);
      }

      return data;
    },
    onSuccess: (data) => {
      if (data?.data?.warning) {
        toast.warning(data.data.warning);
      } else {
        toast.success(isEditing ? "Nome atualizado com sucesso" : "Nome cadastrado com sucesso");
      }
      handleOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["distribution-terms"] });
    },
    onError: (error) => {
      const msg = error.message || '';
      if (msg.includes('já se encontra cadastrado') || msg.includes('já cadastrado')) {
        toast.error('Este nome já está cadastrado no parceiro. Reative-o ou exclua definitivamente antes de cadastrar novamente.');
      } else if (msg.includes('truncated') || msg.includes('excede o limite') || msg.includes('abrangências')) {
        toast.error('A quantidade de abrangências selecionadas excede o limite da API do parceiro (máx. ~100). Reduza a seleção de diários e tente novamente.');
      } else {
        toast.error(`Erro: ${msg}`);
      }
    },
  });

  const dialogTitle = isEditing ? "Editar Nome Monitorado" : "Cadastrar Nome para Monitoramento";
  const dialogDesc = isEditing
    ? "Edite os dados do nome monitorado para distribuições."
    : "Adicione um nome para monitorar novas distribuições. Preencha os dados em cada aba.";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!registerMutation.isPending) handleOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" onPointerDownOutside={(e) => { if (registerMutation.isPending) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (registerMutation.isPending) e.preventDefault(); }}>
        {registerMutation.isPending && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium text-foreground">{isEditing ? "Atualizando nome..." : "Cadastrando nome..."}</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde, estamos processando no parceiro</p>
          </div>
        )}
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDesc}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basics">Dados Básicos</TabsTrigger>
            <TabsTrigger value="docs">Documentos e OAB</TabsTrigger>
            <TabsTrigger value="scope">Abrangências</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[55vh] mt-2">
            <TabsContent value="basics" className="mt-0 px-1">
              <DadosBasicosTab
                form={form} setForm={setForm}
                selectedService={selectedService} setSelectedService={setSelectedService}
                services={services}
                selectedClients={selectedClients} setSelectedClients={setSelectedClients}
                clientError={clientError} setClientError={setClientError}
              />
            </TabsContent>

            <TabsContent value="docs" className="mt-0 px-1">
              <DocumentosOabTab form={form} setForm={setForm} />
            </TabsContent>

            <TabsContent value="scope" className="mt-0 px-1">
              <AbrangenciasTab />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={registerMutation.isPending}>Cancelar</Button>
          <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
            {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Atualizar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────
export default function DistributionTerms() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [newTermDialog, setNewTermDialog] = useState(false);
  const [editTerm, setEditTerm] = useState<DistributionTerm | null>(null);
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false);

  // Fetch distribution terms
  const { data: terms = [], isLoading } = useQuery({
    queryKey: ["distribution-terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_terms")
        .select("*, partners(name), partner_services(id, service_name), client_search_terms(client_systems(id, name))")
        .eq("term_type", "distribution")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DistributionTerm[];
    },
  });

  // Fetch distribution services
  const { data: services } = useQuery({
    queryKey: ["distribution-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_services")
        .select("id, service_name")
        .eq("service_type", "distributions")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Sync mutation — sync terms then distributions
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!services || services.length === 0) throw new Error("Nenhum serviço de distribuições ativo.");
      const serviceId = services[0].id;

      // Step 1: Sync terms from API
      const { data: termsData, error: termsError } = await supabase.functions.invoke("manage-distribution-terms", {
        body: { action: "listNames", serviceId },
      });
      if (termsError) throw termsError;

      // Step 2: Sync distributions
      const { data: distData, error: distError } = await supabase.functions.invoke("sync-distributions", {});
      if (distError) throw distError;

      return { termsData, distData };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["distribution-terms"] });
      const termsCount = data?.termsData?.data?.length || 0;
      const distResults = data?.distData?.results || [];
      const distSynced = distResults.reduce((sum: number, r: any) => sum + (r.recordsSynced || 0), 0);
      toast.success(`Sincronização concluída: ${termsCount} nomes, ${distSynced} distribuições`);
    },
    onError: (error) => toast.error(`Erro ao sincronizar: ${error.message}`),
  });

  // Deactivate mutation — call edge function to deactivate on API + local
  const deactivateMutation = useMutation({
    mutationFn: async (term: DistributionTerm) => {
      if (!term.solucionare_code) {
        // No solucionare_code, just deactivate locally
        const { error } = await supabase.from("search_terms").update({ is_active: false }).eq("id", term.id);
        if (error) throw error;
        return;
      }

      const serviceId = term.partner_services?.id;
      if (!serviceId) throw new Error("Serviço não encontrado para este termo");

      const { data, error } = await supabase.functions.invoke("manage-distribution-terms", {
        body: {
          action: "deactivateName",
          serviceId,
          codNome: term.solucionare_code,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao desativar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-terms"] });
      toast.success("Nome desativado com sucesso");
    },
    onError: (error) => toast.error(`Erro ao desativar: ${error.message}`),
  });

  const filteredTerms = terms.filter((t) => {
    const matchesSearch = !searchQuery || t.term.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || (filterStatus === "active" ? t.is_active : !t.is_active);
    return matchesSearch && matchesStatus;
  });

  const getClientNames = (term: DistributionTerm): string[] => {
    return term.client_search_terms?.map((cst: any) => cst.client_systems?.name).filter(Boolean) || [];
  };

  const handleExport = () => {
    const csv = [
      ["Nome", "Tipo Consulta", "Parceiro", "Serviço", "Status", "Clientes", "Cadastrado em"],
      ...filteredTerms.map((t) => {
        const meta = t.metadata as any;
        const tipoConsulta = TIPO_CONSULTA_OPTIONS.find(o => o.value === String(meta?.codTipoConsulta))?.label || "-";
        return [
          t.term, tipoConsulta, t.partners?.name || "-", t.partner_services?.service_name || "-",
          t.is_active ? "Ativo" : "Inativo", getClientNames(t).join("; ") || "-",
          t.created_at ? format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR }) : "-",
        ];
      }),
    ].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nomes-distribuicao-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Exportado com sucesso");
  };

  const activeCount = terms.filter((t) => t.is_active).length;

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Distribuições", href: "/distributions" }, { label: "Nomes Monitorados" }]} />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nomes Monitorados</h1>
          <p className="text-muted-foreground mt-1">Gerencie os nomes monitorados para novas distribuições</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkLinkOpen(true)} className="gap-2">
            <Link2 className="h-4 w-4" /> Vincular Clientes
          </Button>
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button className="gap-2" onClick={() => setNewTermDialog(true)}>
            <Plus className="h-4 w-4" /> Cadastrar Nome
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Nomes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{terms.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{activeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Inativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-muted-foreground">{terms.length - activeCount}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar nome..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo Consulta</TableHead>
                  <TableHead>Solucionare</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredTerms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum nome encontrado</TableCell>
                  </TableRow>
                ) : (
                  filteredTerms.map((term) => {
                    const clients = getClientNames(term);
                    const meta = term.metadata as any;
                    const tipoLabel = TIPO_CONSULTA_OPTIONS.find(o => o.value === String(meta?.codTipoConsulta))?.label || "-";
                    return (
                      <TableRow key={term.id}>
                        <TableCell className="font-medium">{term.term}</TableCell>
                        <TableCell className="text-sm">{tipoLabel}</TableCell>
                        <TableCell className="text-sm">{term.partners?.name || "-"}</TableCell>
                        <TableCell><ClientBadges clients={clients} /></TableCell>
                        <TableCell>
                          {term.solucionare_status === 'synced' ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Sincronizado
                            </Badge>
                          ) : term.solucionare_status === 'error' ? (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
                              <AlertCircle className="h-3 w-3" /> Erro
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 gap-1">
                              <Clock className="h-3 w-3" /> Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={term.is_active ? "default" : "secondary"}>
                            {term.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {term.created_at ? format(new Date(term.created_at), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => { setEditTerm(term); }}>
                              <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                            </Button>
                            {term.is_active && (
                              <Button size="sm" variant="ghost" className="text-amber-600" onClick={() => {
                                if (confirm("Tem certeza que deseja desativar este nome? Ele será desativado no parceiro.")) deactivateMutation.mutate(term);
                              }}>
                                Desativar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DistributionTermDialog
        open={newTermDialog}
        onOpenChange={setNewTermDialog}
        services={services}
      />

      <DistributionTermDialog
        open={!!editTerm}
        onOpenChange={(o) => { if (!o) setEditTerm(null); }}
        services={services}
        editTerm={editTerm}
      />

      <BulkClientLinkDialog
        open={bulkLinkOpen}
        onOpenChange={setBulkLinkOpen}
        entityType="distribution_terms"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["distribution-terms"] })}
      />
    </div>
  );
}
