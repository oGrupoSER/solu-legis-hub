import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ClientSelector } from "@/components/shared/ClientSelector";
import { Plus, X, Wand2, Search, HelpCircle, Loader2, Ban, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: any;
}

interface TermoBloqueio {
  termo: string;
  contido: boolean;
}

const STEPS = [
  { label: "Dados Básicos", description: "Termo, tipo e clientes" },
  { label: "Variações e Bloqueios", description: "Refine a busca" },
  { label: "Abrangências", description: "Diários monitorados" },
];

export const SearchTermDialog = ({ open, onOpenChange, term }: SearchTermDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    term: "",
    term_type: "office",
    partner_id: "",
    partner_service_id: "",
    is_active: true,
  });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientError, setClientError] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Advanced fields
  const [oab, setOab] = useState("");
  const [variacoes, setVariacoes] = useState<string[]>([]);
  const [novaVariacao, setNovaVariacao] = useState("");
  const [termosBloqueio, setTermosBloqueio] = useState<TermoBloqueio[]>([]);
  const [novoTermoBloqueio, setNovoTermoBloqueio] = useState("");
  const [novoTermoContido, setNovoTermoContido] = useState(false);
  const [abrangencias, setAbrangencias] = useState<string[]>([]);
  const [abrangenciasDisponiveis, setAbrangenciasDisponiveis] = useState<string[]>([]);
  const [abrangenciaSearch, setAbrangenciaSearch] = useState("");
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [isLoadingAbrangencias, setIsLoadingAbrangencias] = useState(false);

  const isNameType = formData.term_type === "name";
  const totalSteps = isNameType ? 3 : 1;

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      fetchPartners();
      if (term) {
        setFormData({
          term: term.term || "",
          term_type: term.term_type || "office",
          partner_id: term.partner_id || "",
          partner_service_id: term.partner_service_id || "",
          is_active: term.is_active ?? true,
        });
        if (term.partner_id) fetchServices(term.partner_id);
        fetchTermClients(term.id);
        const meta = term.metadata || {};
        setVariacoes(meta.variacoes || []);
        setTermosBloqueio(meta.termos_bloqueio || []);
        setAbrangencias(meta.abrangencias || []);
        setOab(meta.oab || "");
      } else {
        resetNewFields();
        setSelectedClients([]);
        setClientError(false);
      }
    }
  }, [open, term]);

  const resetNewFields = () => {
    setOab("");
    setVariacoes([]);
    setNovaVariacao("");
    setTermosBloqueio([]);
    setNovoTermoBloqueio("");
    setNovoTermoContido(false);
    setAbrangencias([]);
    setAbrangenciaSearch("");
    setAbrangenciasDisponiveis([]);
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").eq("is_active", true);
    setPartners(data || []);
  };

  const fetchServices = async (partnerId: string) => {
    if (!partnerId) { setServices([]); return; }
    const { data } = await supabase
      .from("partner_services")
      .select("id, service_name")
      .eq("partner_id", partnerId)
      .eq("service_type", "terms")
      .eq("is_active", true);
    setServices(data || []);
  };

  const fetchTermClients = async (termId: string) => {
    const { data } = await supabase
      .from("client_search_terms")
      .select("client_system_id")
      .eq("search_term_id", termId);
    setSelectedClients((data || []).map((d) => d.client_system_id));
  };

  const resolveServiceId = async (): Promise<string | null> => {
    if (formData.partner_service_id) return formData.partner_service_id;
    const { data } = await supabase
      .from("partner_services")
      .select("id")
      .in("service_type", ["terms", "publications"])
      .eq("is_active", true)
      .limit(1)
      .single();
    return data?.id || null;
  };

  const handleGenerateVariations = async () => {
    if (!formData.term) { toast.error("Preencha o termo primeiro"); return; }
    setIsGeneratingVariations(true);
    try {
      const serviceId = await resolveServiceId();
      if (!serviceId) { toast.error("Nenhum serviço ativo encontrado"); return; }
      const { data, error } = await supabase.functions.invoke("manage-search-terms", {
        body: { service_id: serviceId, action: "gerar_variacoes", data: { nome: formData.term, tipo_variacao: 1 } },
      });
      if (error) throw error;
      const novas = data?.data?.variacoes || [];
      if (novas.length === 0) { toast.info("Nenhuma variação gerada"); }
      else {
        setVariacoes([...new Set([...variacoes, ...novas])]);
        toast.success(`${novas.length} variações geradas`);
      }
    } catch (error: any) { toast.error(error.message || "Erro ao gerar variações"); }
    finally { setIsGeneratingVariations(false); }
  };

  const handleFetchAbrangencias = async () => {
    setIsLoadingAbrangencias(true);
    try {
      const serviceId = await resolveServiceId();
      if (!serviceId) { toast.error("Nenhum serviço ativo encontrado"); return; }
      const { data, error } = await supabase.functions.invoke("manage-search-terms", {
        body: { service_id: serviceId, action: "buscar_abrangencias" },
      });
      if (error) throw error;
      const lista = data?.data?.abrangencias || [];
      setAbrangenciasDisponiveis(lista);
      if (lista.length === 0) toast.info("Nenhuma abrangência retornada");
      else toast.success(`${lista.length} abrangências carregadas`);
    } catch (error: any) { toast.error(error.message || "Erro ao buscar abrangências"); }
    finally { setIsLoadingAbrangencias(false); }
  };

  const addVariacao = () => {
    const v = novaVariacao.trim();
    if (!v) return;
    if (variacoes.includes(v)) { toast.error("Variação já existe"); return; }
    setVariacoes([...variacoes, v]);
    setNovaVariacao("");
  };

  const addTermoBloqueio = () => {
    const t = novoTermoBloqueio.trim();
    if (!t) return;
    if (termosBloqueio.some(tb => tb.termo === t)) { toast.error("Termo já existe"); return; }
    setTermosBloqueio([...termosBloqueio, { termo: t, contido: novoTermoContido }]);
    setNovoTermoBloqueio("");
    setNovoTermoContido(false);
  };

  const toggleAbrangencia = (sigla: string) => {
    setAbrangencias(prev =>
      prev.includes(sigla) ? prev.filter(a => a !== sigla) : [...prev, sigla]
    );
  };

  const filteredAbrangencias = abrangenciasDisponiveis.filter(a =>
    a.toLowerCase().includes(abrangenciaSearch.toLowerCase())
  );

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      if (!formData.term.trim()) { toast.error("Preencha o termo"); return false; }
      if (selectedClients.length === 0) { setClientError(true); toast.error("Selecione ao menos um cliente"); return false; }
      setClientError(false);
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(currentStep + 1, totalSteps - 1));
    }
  };

  const handleBack = () => setCurrentStep(Math.max(currentStep - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep(0)) { setCurrentStep(0); return; }
    setIsLoading(true);
    try {
      const metadata: any = {};
      if (variacoes.length > 0) metadata.variacoes = variacoes;
      if (termosBloqueio.length > 0) metadata.termos_bloqueio = termosBloqueio;
      if (abrangencias.length > 0) metadata.abrangencias = abrangencias;
      if (oab) metadata.oab = oab;

      const dataToSave: any = {
        ...formData,
        partner_id: formData.partner_id || null,
        partner_service_id: formData.partner_service_id || null,
        metadata,
      };

      let termId: string;
      if (term) {
        const { error } = await supabase.from("search_terms").update(dataToSave).eq("id", term.id);
        if (error) throw error;
        termId = term.id;
      } else {
        const { data: inserted, error } = await supabase.from("search_terms").insert(dataToSave).select("id").single();
        if (error) throw error;
        termId = inserted.id;
      }

      await supabase.from("client_search_terms").delete().eq("search_term_id", termId);
      if (selectedClients.length > 0) {
        const links = selectedClients.map((clientId) => ({ search_term_id: termId, client_system_id: clientId }));
        const { error: linkError } = await supabase.from("client_search_terms").insert(links);
        if (linkError) throw linkError;
      }

      toast.success(term ? "Termo atualizado com sucesso" : "Termo criado com sucesso");
      onOpenChange(false);
    } catch (error: any) { toast.error(error.message || "Erro ao salvar termo"); }
    finally { setIsLoading(false); }
  };

  // Auto-load abrangencias when entering step 3
  useEffect(() => {
    if (currentStep === 2 && abrangenciasDisponiveis.length === 0 && !isLoadingAbrangencias) {
      handleFetchAbrangencias();
    }
  }, [currentStep]);

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{term ? "Editar Termo" : "Novo Termo de Busca"}</DialogTitle>
          <DialogDescription>
            {isNameType
              ? `Etapa ${currentStep + 1} de ${totalSteps} — ${STEPS[currentStep].description}`
              : "Configure o termo que será utilizado nas buscas"}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper indicator (only for name type) */}
        {isNameType && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-1">
              {STEPS.slice(0, totalSteps).map((step, i) => (
                <div key={i} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => { if (i < currentStep || validateStep(currentStep)) setCurrentStep(i); }}
                    className={cn(
                      "flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1.5 transition-all w-full",
                      i === currentStep
                        ? "bg-primary text-primary-foreground"
                        : i < currentStep
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span className={cn(
                      "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0",
                      i < currentStep ? "bg-primary text-primary-foreground" : "bg-background/50"
                    )}>
                      {i < currentStep ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="truncate hidden sm:inline">{step.label}</span>
                  </button>
                  {i < totalSteps - 1 && <div className="w-4 h-px bg-border shrink-0 mx-1" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {/* STEP 1: Basic Data */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="term">Termo *</Label>
                  <Input
                    id="term"
                    value={formData.term}
                    onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                    placeholder="Digite o termo de busca"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={formData.term_type} onValueChange={(value) => setFormData({ ...formData, term_type: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office">Escritório</SelectItem>
                      <SelectItem value="name">Nome de Pesquisa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isNameType && (
                <div className="space-y-2">
                  <Label htmlFor="oab">OAB (opcional)</Label>
                  <Input
                    id="oab"
                    value={oab}
                    onChange={(e) => setOab(e.target.value)}
                    placeholder="Ex: 123456|MG"
                  />
                  <p className="text-xs text-muted-foreground">Formato: CÓDIGO|UF</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parceiro (opcional)</Label>
                  <Select
                    value={formData.partner_id}
                    onValueChange={(value) => {
                      const partnerId = value === "none" ? "" : value;
                      setFormData({ ...formData, partner_id: partnerId, partner_service_id: "" });
                      fetchServices(partnerId);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.partner_id && (
                  <div className="space-y-2">
                    <Label>Serviço (opcional)</Label>
                    <Select
                      value={formData.partner_service_id}
                      onValueChange={(value) => setFormData({ ...formData, partner_service_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <ClientSelector
                serviceId={formData.partner_service_id || undefined}
                selectedIds={selectedClients}
                onChange={(ids) => { setSelectedClients(ids); setClientError(false); }}
                error={clientError}
              />

              <div className="flex items-center justify-between pt-2 border-t">
                <Label htmlFor="active">Termo Ativo</Label>
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Variations & Blocking Terms */}
          {currentStep === 1 && isNameType && (
            <div className="space-y-6">
              {/* Variations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">Variações</h4>
                    <p className="text-xs text-muted-foreground">Variações ortográficas que também serão monitoradas</p>
                  </div>
                  {variacoes.length > 0 && <Badge variant="secondary">{variacoes.length}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={novaVariacao}
                    onChange={(e) => setNovaVariacao(e.target.value)}
                    placeholder="Adicionar variação..."
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariacao(); } }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addVariacao} className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleGenerateVariations}
                          disabled={isGeneratingVariations || !formData.term}
                          className="shrink-0"
                        >
                          {isGeneratingVariations ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Gerar variações automaticamente</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {variacoes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {variacoes.map((v, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 pr-1">
                        {v}
                        <button type="button" onClick={() => setVariacoes(variacoes.filter((_, j) => j !== i))} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="border-t" />

              {/* Blocking Terms */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-destructive" />
                    <div>
                      <h4 className="text-sm font-semibold">Termos de Bloqueio</h4>
                      <p className="text-xs text-muted-foreground">Impedem a captura quando encontrados junto ao nome</p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Termos de bloqueio impedem a captura de publicações quando encontrados junto ao nome pesquisado.
                          Marque "contido no nome" para bloquear apenas quando o termo estiver contido no texto do nome.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {termosBloqueio.length > 0 && <Badge variant="secondary">{termosBloqueio.length}</Badge>}
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={novoTermoBloqueio}
                      onChange={(e) => setNovoTermoBloqueio(e.target.value)}
                      placeholder="Termo bloqueador..."
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTermoBloqueio(); } }}
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="contido"
                        checked={novoTermoContido}
                        onCheckedChange={(checked) => setNovoTermoContido(checked === true)}
                      />
                      <label htmlFor="contido" className="text-xs text-muted-foreground cursor-pointer">
                        Somente quando contido no nome
                      </label>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={addTermoBloqueio} className="shrink-0 mb-6">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {termosBloqueio.length > 0 && (
                  <div className="space-y-1.5">
                    {termosBloqueio.map((tb, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5 text-sm">
                        <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="flex-1 font-medium">{tb.termo}</span>
                        {tb.contido && <Badge variant="outline" className="text-xs">contido</Badge>}
                        <button type="button" onClick={() => setTermosBloqueio(termosBloqueio.filter((_, j) => j !== i))} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Scopes (Abrangências) */}
          {currentStep === 2 && isNameType && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Abrangências (Diários)</h4>
                  <p className="text-xs text-muted-foreground">Selecione os diários oficiais que serão monitorados</p>
                </div>
                {abrangencias.length > 0 && (
                  <Badge variant="secondary">{abrangencias.length} selecionados</Badge>
                )}
              </div>

              {isLoadingAbrangencias ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Carregando abrangências...</span>
                </div>
              ) : abrangenciasDisponiveis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <p className="text-sm text-muted-foreground">Nenhuma abrangência carregada</p>
                  <Button type="button" variant="outline" className="gap-2" onClick={handleFetchAbrangencias}>
                    <Search className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={abrangenciaSearch}
                      onChange={(e) => setAbrangenciaSearch(e.target.value)}
                      placeholder="Filtrar diários..."
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAbrangencias([...abrangenciasDisponiveis])}>
                      Selecionar Todos
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAbrangencias([])}>
                      Limpar
                    </Button>
                    <span className="text-xs text-muted-foreground self-center ml-auto">
                      {filteredAbrangencias.length} diários
                    </span>
                  </div>
                  <ScrollArea className="h-[250px] rounded-md border">
                    <div className="p-2 space-y-0.5">
                      {filteredAbrangencias.map((sigla) => (
                        <div
                          key={sigla}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-1.5 rounded-md cursor-pointer transition-colors text-sm",
                            abrangencias.includes(sigla) ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                          )}
                          onClick={() => toggleAbrangencia(sigla)}
                        >
                          <Checkbox checked={abrangencias.includes(sigla)} onCheckedChange={() => toggleAbrangencia(sigla)} />
                          <span className="font-medium">{sigla}</span>
                        </div>
                      ))}
                      {filteredAbrangencias.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">Nenhum diário encontrado</p>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
          <Button
            type="button"
            variant="ghost"
            onClick={() => currentStep > 0 ? handleBack() : onOpenChange(false)}
            className="gap-1.5"
          >
            {currentStep > 0 ? (
              <><ChevronLeft className="h-4 w-4" /> Voltar</>
            ) : (
              "Cancelar"
            )}
          </Button>

          <div className="flex gap-2">
            {isLastStep ? (
              <Button onClick={handleSubmit} disabled={isLoading} className="gap-1.5">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isLoading ? "Salvando..." : term ? "Atualizar" : "Criar"}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext} className="gap-1.5">
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
