import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, AuthProvider } from "@/context/AuthContext";
import { TaskProvider } from "@/context/TaskContext";
import { CatalogProvider } from "@/context/CatalogContext";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import CatalogPage from "@/pages/CatalogPage";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const ProtectedRoutes = () => {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TaskProvider>
        <CatalogProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <ProtectedRoutes />
          </TooltipProvider>
        </CatalogProvider>
      </TaskProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
