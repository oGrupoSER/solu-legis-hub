import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  from: Date | undefined;
  to: Date | undefined;
  onSelect: (range: { from: Date | undefined; to: Date | undefined }) => void;
}

export function DateRangePicker({ from, to, onSelect }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDateRange = () => {
    if (from && to) {
      return `${format(from, "dd/MM/yyyy")} - ${format(to, "dd/MM/yyyy")}`;
    }
    if (from) {
      return `${format(from, "dd/MM/yyyy")} - ...`;
    }
    return "Selecionar período";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !from && !to && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={from}
          selected={{ from, to }}
          onSelect={(range) => {
            onSelect({ from: range?.from, to: range?.to });
            if (range?.from && range?.to) {
              setIsOpen(false);
            }
          }}
          numberOfMonths={2}
          locale={ptBR}
        />
        <div className="flex items-center justify-between p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect({ from: undefined, to: undefined });
              setIsOpen(false);
            }}
          >
            Limpar
          </Button>
          <Button
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
