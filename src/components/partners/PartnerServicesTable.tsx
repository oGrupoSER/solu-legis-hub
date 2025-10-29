import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import PartnerServiceDialog from "./PartnerServiceDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface PartnerService {
  id: string;
  partner_id: string;
  service_name: string;
  service_type: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  is_active: boolean;
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
      toast({
        title: "Erro ao carregar serviços",
        description: "Não foi possível carregar os serviços do parceiro",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso",
      });

      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Erro ao excluir serviço",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        variant: "destructive",
      });
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
      publications: "Publicações"
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
  );
};

export default PartnerServicesTable;
