import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PartnerServicesTable from "@/components/partners/PartnerServicesTable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";

const PartnerServices = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const partnerId = searchParams.get("partnerId");
  const [partnerName, setPartnerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!partnerId) {
      toast.error("ID do parceiro não fornecido");
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
      toast.error("Não foi possível carregar as informações do parceiro");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: partnerName },
        ]}
      />
      {partnerId && <PartnerServicesTable partnerId={partnerId} partnerName={partnerName} />}
    </div>
  );
};

export default PartnerServices;
