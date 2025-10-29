import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import PartnerServicesTable from "@/components/partners/PartnerServicesTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PartnerServices = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const partnerId = searchParams.get("partnerId");
  const [partnerName, setPartnerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) {
      toast({
        title: "Erro",
        description: "ID do parceiro não fornecido",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    fetchPartner();
  }, [partnerId, navigate]);

  const fetchPartner = async () => {
    if (!partnerId) return;

    try {
      const { data, error } = await supabase
        .from("partners")
        .select("name")
        .eq("id", partnerId)
        .single();

      if (error) throw error;
      setPartnerName(data.name);
    } catch (error) {
      console.error("Error fetching partner:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as informações do parceiro",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {partnerId && <PartnerServicesTable partnerId={partnerId} partnerName={partnerName} />}
    </div>
  );
};

export default PartnerServices;
