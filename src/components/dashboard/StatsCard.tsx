import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export const StatsCard = ({ title, value, icon: Icon, description, trend, className }: StatsCardProps) => {
  return (
    <Card className={cn("transition-all hover:shadow-lg", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <p className={cn("text-xs mt-2 font-medium", trend.isPositive ? "text-success" : "text-destructive")}>
            {trend.isPositive ? "+" : ""}
            {trend.value}% desde o mês passado
          </p>
        )}
      </CardContent>
    </Card>
  );
};
