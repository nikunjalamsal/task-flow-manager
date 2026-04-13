import { useAuth, AuthProvider } from "@/context/AuthContext";
import { TaskProvider } from "@/context/TaskContext";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const AppContent = () => {
  const { user } = useAuth();
  return user ? <Dashboard /> : <LoginPage />;
};



const App = () => (
  <AuthProvider>
    <TaskProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </TaskProvider>
  </AuthProvider>
);

export default App;
