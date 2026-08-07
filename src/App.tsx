import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ClientsPage from "@/pages/Clients";
import InvoiceEditor from "@/pages/InvoiceEditor";
import InvoicesList from "@/pages/InvoicesList";
import InvoiceDetail from "@/pages/InvoiceDetail";
import SettingsPage from "@/pages/SettingsPage";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";

function InvoiceEditorRoute() {
  const { pathname } = useLocation();
  return <InvoiceEditor key={pathname} />;
}

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/invoices" element={<InvoicesList />} />
        <Route path="/invoices/new" element={<InvoiceEditorRoute />} />
        <Route path="/invoices/:id/edit" element={<InvoiceEditorRoute />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter basename={basename}>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
