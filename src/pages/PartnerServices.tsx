import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import PartnerServicesTable from "@/components/partners/PartnerServicesTable";
import { toast } from "sonner";

const PartnerServices = () => {
  const { partnerId: paramPartnerId } = useParams<{ partnerId: string }>();
  const [searchParams] = useSearchParams();
  const queryPartnerId = searchParams.get("partnerId");
  const partnerId = paramPartnerId || queryPartnerId;
  
  const navigate = useNavigate();
  const [partnerName, setPartnerName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) {
      toast.error("ID do parceiro não fornecido");
      navigate("/partners");
      return;
    }
    fetchPartner();
  }, [partnerId]);

  const fetchPartner = async () => {
    try {
      const { data, error } = await supabase
        .from("partners")
        .select("name")
        .eq("id", partnerId)
        .single();

      if (error) throw error;
      setPartnerName(data?.name || "");
    } catch (error) {
      console.error("Error fetching partner:", error);
      toast.error("Não foi possível carregar as informações do parceiro");
      navigate("/partners");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex justify-center p-8">Carregando...</div>
      </div>
    );
  }

  if (!partnerId) {
    return null;
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/partners")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Serviços de {partnerName}</h1>
      </div>

      <PartnerServicesTable partnerId={partnerId} partnerName={partnerName} />
    </div>
  );
};

export default PartnerServices;
