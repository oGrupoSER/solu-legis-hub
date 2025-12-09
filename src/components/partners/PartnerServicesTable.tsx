import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, Activity, RefreshCw, TestTube, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PartnerServiceDialog from "./PartnerServiceDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ServiceHealthCheck } from "./ServiceHealthCheck";

interface PartnerService {
  id: string;
  partner_id: string;
  service_name: string;
  service_type: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  is_active: boolean;
  confirm_receipt: boolean;
  config: any;
  last_sync_at: string | null;
  created_at: string;
}

interface PartnerServicesTableProps {
  partnerId: string;
  partnerName: string;
}

const PartnerServicesTable = ({ partnerId, partnerName }: PartnerServicesTableProps) => {
  const [services, setServices] = useState<PartnerService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<PartnerService | undefined>();
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [syncingService, setSyncingService] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, [partnerId]);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("partner_services")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (serviceId: string, serviceType: string) => {
    setSyncingService(serviceId);
    try {
      const { data, error } = await supabase.functions.invoke("sync-orchestrator", {
        body: { 
          services: [{ service_id: serviceId, type: serviceType }],
          mode: "sequential" 
        },
      });

      if (error) throw error;
      toast.success("Sincronização iniciada com sucesso");
      setTimeout(fetchServices, 2000);
    } catch (error: any) {
      toast.error("Erro ao iniciar sincronização");
    } finally {
      setSyncingService(null);
    }
  };

  const handleEdit = (service: PartnerService) => {
    setSelectedService(service);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("partner_services")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Serviço excluído com sucesso");
      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Erro ao excluir serviço");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedService(undefined);
    fetchServices();
  };

  const getServiceTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      processes: "Andamentos",
      distributions: "Distribuições",
      publications: "Publicações",
      terms: "Termos e Escritórios"
    };
    return types[type] || type;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    return new Date(dateString).toLocaleString("pt-BR");
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando serviços...</div>;
  }

  return (
    <Tabs defaultValue="services" className="space-y-6">
      <TabsList>
        <TabsTrigger value="services">Serviços</TabsTrigger>
        <TabsTrigger value="health">Status</TabsTrigger>
      </TabsList>

      <TabsContent value="services" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Serviços de {partnerName}</CardTitle>
                <CardDescription>
                  Gerencie os serviços de integração do parceiro
                </CardDescription>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Serviço
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum serviço cadastrado. Adicione um serviço para começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getServiceTypeLabel(service.service_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={service.service_url}>
                        {service.service_url}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.is_active ? "default" : "secondary"}>
                          <Activity className="mr-1 h-3 w-3" />
                          {service.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(service.last_sync_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSync(service.id, service.service_type)}
                            disabled={syncingService === service.id}
                            title="Sincronizar agora"
                          >
                            <RefreshCw className={`h-4 w-4 ${syncingService === service.id ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setServiceToDelete(service.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <PartnerServiceDialog
              open={dialogOpen}
              onOpenChange={handleDialogClose}
              partnerId={partnerId}
              service={selectedService}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (serviceToDelete) {
                        handleDelete(serviceToDelete);
                        setDeleteDialogOpen(false);
                        setServiceToDelete(null);
                      }
                    }}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="health" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <ServiceHealthCheck
              key={service.id}
              serviceId={service.id}
              serviceName={service.service_name}
              serviceUrl={service.service_url}
              serviceType={service.service_type}
            />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default PartnerServicesTable;
