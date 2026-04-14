import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTasks } from "@/context/TaskContext";
import { exportTasksToExcel } from "@/lib/exportExcel";
import TaskForm from "@/components/TaskForm";
import TaskCalendar from "@/components/TaskCalendar";
import ManagerApprovals from "@/components/ManagerApprovals";
import AllTasks from "@/components/AllTasks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, ClipboardList, LogOut, Shield, LayoutDashboard, Download, User as UserIcon, PlayCircle } from "lucide-react";

const Dashboard: React.FC = () => {
  const { user, logout, isManager, isViewer, isBssTeam } = useAuth();
  const { tasks, getPendingApprovalTasks } = useTasks();

  const pendingTasks = getPendingApprovalTasks();
  const myPendingApprovals = pendingTasks.filter((t) =>
    isManager ||
    (t.status === "delete_requested" && t.assigneeId === user?.id)
  );
  const pendingCount = myPendingApprovals.length;

  // Stats based on ALL tasks (visible to everyone)
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => t.status === "in_progress").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  // My tasks = tasks created by current user
  const myTaskCount = tasks.filter((t) => t.assigneeId === user?.id).length;

  // Tasks to start = approved but not yet started
  const tasksToStart = tasks.filter((t) => t.status === "approved").length;

  const handleExport = () => {
    const tasksToExport = isManager ? tasks : tasks.filter((t) => t.assigneeId === user?.id);
    exportTasksToExcel(tasksToExport);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <CalendarDays className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground leading-tight">BSS Task Calendar</h1>
              <p className="text-xs text-muted-foreground">Team Scheduling System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                {(isManager || isBssTeam) && <Shield className="h-3 w-3" />}
                {isManager ? "Manager" : isBssTeam ? "BSS Team" : isViewer ? "Viewer" : "Team Member"}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={logout} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Total Tasks" value={totalTasks} icon={<ClipboardList className="h-5 w-5" />} />
          <StatCard label="Active" value={activeTasks} icon={<LayoutDashboard className="h-5 w-5" />} color="text-primary" />
          <StatCard label="Completed" value={completedTasks} icon={<CalendarDays className="h-5 w-5" />} color="text-success" />
          <StatCard label="My Tasks" value={myTaskCount} icon={<UserIcon className="h-5 w-5" />} color="text-accent-foreground" />
          <StatCard label="Tasks To Start" value={tasksToStart} icon={<PlayCircle className="h-5 w-5" />} color="text-amber-600" />
        </div>

        {(isManager || isBssTeam) && pendingCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-2 text-sm text-amber-800">
            <Shield className="h-4 w-4" />
            <span><strong>{pendingCount}</strong> pending approval{pendingCount > 1 ? "s" : ""} require your attention.</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          {!isViewer && (
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export to Excel
            </Button>
          )}
          {!isViewer && <TaskForm />}
        </div>

        <Tabs defaultValue="calendar">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Calendar</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> All Tasks</TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1.5 relative">
              <Shield className="h-3.5 w-3.5" /> Approvals
              {pendingCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">{pendingCount}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="mt-6">
            <TaskCalendar />
          </TabsContent>
          <TabsContent value="tasks" className="mt-6">
            <AllTasks />
          </TabsContent>
          <TabsContent value="approvals" className="mt-6">
            <ManagerApprovals />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className={`${color || "text-muted-foreground"}`}>{icon}</span>
      <span className={`font-display text-2xl font-bold ${color || "text-foreground"}`}>{value}</span>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
  </div>
);

export default Dashboard;
