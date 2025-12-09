import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import PartnerServices from "./pages/PartnerServices";
import SyncLogs from "./pages/SyncLogs";
import Publications from "./pages/Publications";
import ApiMonitoring from "./pages/ApiMonitoring";
import SearchTerms from "./pages/SearchTerms";
import ApiTesting from "./pages/ApiTesting";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import Processes from "./pages/Processes";
import ProcessDetails from "./pages/ProcessDetails";
import Distributions from "./pages/Distributions";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/*"
          element={
            <MainLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/processes" element={<Processes />} />
                <Route path="/processes/:id" element={<ProcessDetails />} />
                <Route path="/distributions" element={<Distributions />} />
                <Route path="/sync-logs" element={<SyncLogs />} />
                <Route path="/publications" element={<Publications />} />
                <Route path="/api-monitoring" element={<ApiMonitoring />} />
                <Route path="/search-terms" element={<SearchTerms />} />
                <Route path="/api-testing" element={<ApiTesting />} />
                <Route path="/partner-services" element={<PartnerServices />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/help" element={<Help />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MainLayout>
          }
        />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
