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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ClientSelector } from "@/components/shared/ClientSelector";
import { Plus, X, Wand2, ChevronDown, ChevronRight, Search, HelpCircle, Loader2, Ban } from "lucide-react";

interface SearchTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: any;
}

interface TermoBloqueio {
  termo: string;
  contido: boolean;
}

export const SearchTermDialog = ({ open, onOpenChange, term }: SearchTermDialogProps) => {
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

  // New fields
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
  const [abrangenciasOpen, setAbrangenciasOpen] = useState(false);

  useEffect(() => {
    if (open) {
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
        // Load metadata
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

  // Generate variations automatically via SOAP
  const handleGenerateVariations = async () => {
    if (!formData.partner_service_id || !formData.term) {
      toast.error("Selecione um serviço e preencha o termo primeiro");
      return;
    }
    setIsGeneratingVariations(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-search-terms", {
        body: {
          service_id: formData.partner_service_id,
          action: "gerar_variacoes",
          data: { nome: formData.term, tipo_variacao: 1 },
        },
      });
      if (error) throw error;
      const novas = data?.data?.variacoes || [];
      if (novas.length === 0) {
        toast.info("Nenhuma variação gerada automaticamente");
      } else {
        // Merge without duplicates
        const merged = [...new Set([...variacoes, ...novas])];
        setVariacoes(merged);
        toast.success(`${novas.length} variações geradas`);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar variações");
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  // Fetch available abrangencias via SOAP
  const handleFetchAbrangencias = async () => {
    if (!formData.partner_service_id) {
      toast.error("Selecione um serviço primeiro");
      return;
    }
    setIsLoadingAbrangencias(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-search-terms", {
        body: {
          service_id: formData.partner_service_id,
          action: "buscar_abrangencias",
        },
      });
      if (error) throw error;
      const lista = data?.data?.abrangencias || [];
      setAbrangenciasDisponiveis(lista);
      if (lista.length === 0) {
        toast.info("Nenhuma abrangência disponível retornada");
      } else {
        toast.success(`${lista.length} abrangências carregadas`);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao buscar abrangências");
    } finally {
      setIsLoadingAbrangencias(false);
    }
  };

  const addVariacao = () => {
    const v = novaVariacao.trim();
    if (!v) return;
    if (variacoes.includes(v)) { toast.error("Variação já existe"); return; }
    setVariacoes([...variacoes, v]);
    setNovaVariacao("");
  };

  const removeVariacao = (index: number) => {
    setVariacoes(variacoes.filter((_, i) => i !== index));
  };

  const addTermoBloqueio = () => {
    const t = novoTermoBloqueio.trim();
    if (!t) return;
    if (termosBloqueio.some(tb => tb.termo === t)) { toast.error("Termo de bloqueio já existe"); return; }
    setTermosBloqueio([...termosBloqueio, { termo: t, contido: novoTermoContido }]);
    setNovoTermoBloqueio("");
    setNovoTermoContido(false);
  };

  const removeTermoBloqueio = (index: number) => {
    setTermosBloqueio(termosBloqueio.filter((_, i) => i !== index));
  };

  const toggleAbrangencia = (sigla: string) => {
    setAbrangencias(prev =>
      prev.includes(sigla) ? prev.filter(a => a !== sigla) : [...prev, sigla]
    );
  };

  const filteredAbrangencias = abrangenciasDisponiveis.filter(a =>
    a.toLowerCase().includes(abrangenciaSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedClients.length === 0) {
      setClientError(true);
      toast.error("Selecione ao menos um cliente");
      return;
    }
    setClientError(false);
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

      // Sync client links
      await supabase.from("client_search_terms").delete().eq("search_term_id", termId);
      if (selectedClients.length > 0) {
        const links = selectedClients.map((clientId) => ({
          search_term_id: termId,
          client_system_id: clientId,
        }));
        const { error: linkError } = await supabase.from("client_search_terms").insert(links);
        if (linkError) throw linkError;
      }

      toast.success(term ? "Termo atualizado com sucesso" : "Termo criado com sucesso");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar termo");
    } finally {
      setIsLoading(false);
    }
  };

  const isNameType = formData.term_type === "name";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{term ? "Editar Termo" : "Novo Termo de Busca"}</DialogTitle>
          <DialogDescription>
            Configure o termo que será utilizado nas buscas e sincronizações
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Term */}
          <div className="space-y-2">
            <Label htmlFor="term">Termo</Label>
            <Input
              id="term"
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              placeholder="Digite o termo de busca"
              required
            />
          </div>

          {/* Type */}
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

          {/* OAB (only for name type) */}
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

          {/* Partner */}
          <div className="space-y-2">
            <Label htmlFor="partner">Parceiro (opcional)</Label>
            <Select
              value={formData.partner_id}
              onValueChange={(value) => {
                const partnerId = value === "none" ? "" : value;
                setFormData({ ...formData, partner_id: partnerId, partner_service_id: "" });
                fetchServices(partnerId);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um parceiro" /></SelectTrigger>
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
              <Label htmlFor="service">Serviço (opcional)</Label>
              <Select
                value={formData.partner_service_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, partner_service_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ClientSelector
            serviceId={formData.partner_service_id || undefined}
            selectedIds={selectedClients}
            onChange={(ids) => { setSelectedClients(ids); setClientError(false); }}
            error={clientError}
          />

          {/* === VARIATIONS SECTION === */}
          {isNameType && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full py-2 hover:text-primary transition-colors">
                <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                Variações
                {variacoes.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">{variacoes.length}</Badge>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <Input
                    value={novaVariacao}
                    onChange={(e) => setNovaVariacao(e.target.value)}
                    placeholder="Adicionar variação..."
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVariacao(); } }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addVariacao}>
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
                          disabled={isGeneratingVariations || !formData.partner_service_id}
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
                        <button type="button" onClick={() => removeVariacao(i)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Variações ortográficas do nome que também serão monitoradas
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* === BLOCKING TERMS SECTION === */}
          {isNameType && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full py-2 hover:text-primary transition-colors">
                <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                <Ban className="h-4 w-4" />
                Termos de Bloqueio
                {termosBloqueio.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">{termosBloqueio.length}</Badge>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Termos de bloqueio impedem a captura de publicações quando encontrados junto ao nome pesquisado
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
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
                  <Button type="button" variant="outline" size="icon" onClick={addTermoBloqueio} className="shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {termosBloqueio.length > 0 && (
                  <div className="space-y-1.5">
                    {termosBloqueio.map((tb, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5 text-sm">
                        <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="flex-1 font-medium">{tb.termo}</span>
                        {tb.contido && (
                          <Badge variant="outline" className="text-xs">contido</Badge>
                        )}
                        <button type="button" onClick={() => removeTermoBloqueio(i)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* === SCOPES (ABRANGENCIAS) SECTION === */}
          {isNameType && (
            <Collapsible open={abrangenciasOpen} onOpenChange={setAbrangenciasOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full py-2 hover:text-primary transition-colors">
                <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                Abrangências (Diários)
                {abrangencias.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">{abrangencias.length} selecionados</Badge>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {abrangenciasDisponiveis.length === 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleFetchAbrangencias}
                    disabled={isLoadingAbrangencias || !formData.partner_service_id}
                  >
                    {isLoadingAbrangencias ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Carregar abrangências disponíveis
                  </Button>
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
                    </div>
                    <ScrollArea className="h-[150px] rounded-md border p-2">
                      <div className="space-y-1">
                        {filteredAbrangencias.map((sigla) => (
                          <div
                            key={sigla}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleAbrangencia(sigla)}
                          >
                            <Checkbox
                              checked={abrangencias.includes(sigla)}
                              onCheckedChange={() => toggleAbrangencia(sigla)}
                            />
                            <span className="text-sm">{sigla}</span>
                          </div>
                        ))}
                        {filteredAbrangencias.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhum diário encontrado</p>
                        )}
                      </div>
                    </ScrollArea>
                  </>
                )}
                {abrangencias.length > 0 && abrangenciasDisponiveis.length === 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {abrangencias.map((a, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 pr-1">
                        {a}
                        <button type="button" onClick={() => setAbrangencias(abrangencias.filter((_, j) => j !== i))} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="active">Termo Ativo</Label>
            <Switch
              id="active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : term ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
