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
import ApiMonitoring from "./pages/ApiMonitoring";
import SearchTerms from "./pages/SearchTerms";
import ApiTesting from "./pages/ApiTesting";
import NotFound from "./pages/NotFound";

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
                <Route path="/sync-logs" element={<SyncLogs />} />
                <Route path="/api-monitoring" element={<ApiMonitoring />} />
                <Route path="/search-terms" element={<SearchTerms />} />
                <Route path="/api-testing" element={<ApiTesting />} />
                <Route path="/partner-services" element={<PartnerServices />} />
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
