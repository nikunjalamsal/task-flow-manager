import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTasks } from "@/context/TaskContext";
import TaskCard from "./TaskCard";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ManagerApprovals: React.FC = () => {
  const { user, isManager } = useAuth();
  const { getPendingApprovalTasks, updateTaskStatus } = useTasks();
  const allPending = getPendingApprovalTasks();

  // Managers see all pending approvals; others see only delete requests on their own tasks
  const pending = isManager
    ? allPending
    : allPending.filter((t) => t.status === "delete_requested" && t.assigneeId === user?.id);

  const approvableTasks = pending.filter((t) => t.status === "pending_approval");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchComment, setBatchComment] = useState("");
  const [showBatch, setShowBatch] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === approvableTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(approvableTasks.map((t) => t.id)));
    }
  };

  const handleBatchApprove = () => {
    if (!user || selectedIds.size === 0 || !batchComment.trim()) return;
    selectedIds.forEach((id) => {
      updateTaskStatus(id, "approved", user.id, user.name, batchComment);
    });
    toast.success(`${selectedIds.size} task(s) approved.`);
    setSelectedIds(new Set());
    setBatchComment("");
    setShowBatch(false);
  };

  const handleBatchReject = () => {
    if (!user || selectedIds.size === 0 || !batchComment.trim()) return;
    selectedIds.forEach((id) => {
      updateTaskStatus(id, "rejected", user.id, user.name, batchComment);
    });
    toast.success(`${selectedIds.size} task(s) rejected.`);
    setSelectedIds(new Set());
    setBatchComment("");
    setShowBatch(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="font-display text-xl font-bold text-foreground">Pending Approvals</h2>
          {pending.length > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">{pending.length}</span>
          )}
        </div>
        {isManager && approvableTasks.length > 1 && (
          <Button size="sm" variant="outline" onClick={() => setShowBatch(!showBatch)} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Batch Approve
          </Button>
        )}
      </div>

      {showBatch && isManager && approvableTasks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedIds.size === approvableTasks.length && approvableTasks.length > 0}
              onCheckedChange={selectAll}
            />
            <span className="text-sm font-medium text-foreground">
              Select All ({selectedIds.size}/{approvableTasks.length})
            </span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {approvableTasks.map((t) => (
              <label key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-2 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={selectedIds.has(t.id)}
                  onCheckedChange={() => toggleSelect(t.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">by {t.assigneeName} • {t.assignedDate}</p>
                </div>
              </label>
            ))}
          </div>
          <Textarea
            value={batchComment}
            onChange={(e) => setBatchComment(e.target.value)}
            placeholder="Add a comment for all selected tasks (required)..."
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleBatchApprove}
              disabled={selectedIds.size === 0 || !batchComment.trim()}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Approve {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBatchReject}
              disabled={selectedIds.size === 0 || !batchComment.trim()}
            >
              Reject {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowBatch(false); setSelectedIds(new Set()); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

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
