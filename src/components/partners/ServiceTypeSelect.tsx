import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ServiceTypeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export const ServiceTypeSelect = ({ value, onValueChange }: ServiceTypeSelectProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="service_type">Tipo de Serviço</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="service_type">
          <SelectValue placeholder="Selecione o tipo de serviço" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="publications">Publicações (REST API)</SelectItem>
          <SelectItem value="processes">Processos (SOAP)</SelectItem>
          <SelectItem value="distributions">Distribuições (SOAP)</SelectItem>
          <SelectItem value="terms">Termos e Escritórios (SOAP)</SelectItem>
          <SelectItem value="diary_status">Status dos Diários (REST API)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
