import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTasks } from "@/context/TaskContext";
import TaskCard from "./TaskCard";
import { AlertTriangle } from "lucide-react";

const ManagerApprovals: React.FC = () => {
  const { user, isManager } = useAuth();
  const { getPendingApprovalTasks } = useTasks();
  const allPending = getPendingApprovalTasks();
  
  // Managers see all pending approvals; others see only delete requests on their own tasks
  const pending = isManager
    ? allPending
    : allPending.filter((t) => t.status === "delete_requested" && t.assigneeId === user?.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h2 className="font-display text-xl font-bold text-foreground">Pending Approvals</h2>
        {pending.length > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">{pending.length}</span>
        )}
      </div>
      {pending.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No pending approvals. All caught up! 🎉</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ManagerApprovals;
