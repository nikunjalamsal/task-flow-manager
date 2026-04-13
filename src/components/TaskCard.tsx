import React, { useState } from "react";
import { Task, TaskStatus } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useTasks } from "@/context/TaskContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, CheckCircle2, Clock, Play, XCircle, MessageSquare, ArrowRight, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="h-3 w-3" /> },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  in_progress: { label: "In Progress", color: "bg-purple-100 text-purple-800 border-purple-200", icon: <Play className="h-3 w-3" /> },
  bss_completed: { label: "BSS Completed", color: "bg-teal-100 text-teal-800 border-teal-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  delete_requested: { label: "Delete Requested", color: "bg-orange-100 text-orange-800 border-orange-200", icon: <AlertTriangle className="h-3 w-3" /> },
};

const priorityColors: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-red-100 text-red-800",
};

interface TaskCardProps {
  task: Task;
  compact?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, compact }) => {
  const { user, isManager, isViewer } = useAuth();
  const { updateTaskStatus, changeTaskDate, deleteTask, approveDelete, rejectDelete } = useTasks();
  const [detailOpen, setDetailOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [newDate, setNewDate] = useState<Date>();
  const [changingDate, setChangingDate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sc = statusConfig[task.status];
  const isBssTeam = !!(user as any)?.isBssTeam || user?.id === "bss-1" || user?.id === "dummy-bss";

  // Completed tasks cannot be deleted at all
  const isCompleted = task.status === "completed";
  // Only the creator can delete directly; others must request approval
  const isCreator = user && user.id === task.assigneeId;
  const canDelete = !isViewer && !isCompleted && user && isCreator;
  const canRequestDelete = !isViewer && !isCompleted && user && !isCreator;

  const handleAction = (status: TaskStatus) => {
    if (!user) return;
    updateTaskStatus(task.id, status, user.id, user.name, comment);
    toast.success(`Task ${status === "rejected" ? "rejected" : status === "approved" ? "approved" : status === "in_progress" ? "started" : "completed"}.`);
    setComment("");
  };

  const handleDateChange = () => {
    if (!user || !newDate) return;
    const result = changeTaskDate(task.id, format(newDate, "yyyy-MM-dd"), user.id, user.name, comment);
    toast[result.message.includes("approval") ? "info" : "success"](result.message);
    setComment("");
    setChangingDate(false);
    setNewDate(undefined);
  };

  const handleDelete = () => {
    if (!user) return;
    const result = deleteTask(task.id, user.id, user.name, comment);
    toast[result.message.includes("approval") || result.message.includes("request") ? "info" : "success"](result.message);
    setComment("");
    setConfirmDelete(false);
  };

  const handleApproveDelete = () => {
    if (!user) return;
    approveDelete(task.id, user.id, user.name, comment);
    toast.success("Task deleted.");
    setComment("");
  };

  const handleRejectDelete = () => {
    if (!user) return;
    rejectDelete(task.id, user.id, user.name, comment);
    toast.success("Delete request rejected. Task restored.");
    setComment("");
  };

  if (compact) {
    return (
      <button onClick={() => setDetailOpen(true)} className="w-full rounded-md border border-border bg-card p-2 text-left text-xs hover:shadow-md transition-shadow">
        <p className="font-medium truncate text-card-foreground">{task.title}</p>
        <div className="mt-1 flex items-center gap-1">
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", sc.color)}>
            {sc.icon} {sc.label}
          </span>
        </div>
        <TaskDetailDialog task={task} open={detailOpen} onOpenChange={setDetailOpen} />
      </button>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow animate-fade-in">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-card-foreground truncate">{task.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          </div>
          <Badge variant="outline" className={cn("shrink-0", priorityColors[task.priority])}>{task.priority}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>📅 Launch: {format(new Date(task.assignedDate), "MMM d, yyyy")}</span>
          <span>👤 {task.assigneeName}</span>
          <span>🏢 {task.assignedTo}</span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", sc.color)}>
            {sc.icon} {sc.label}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDetailOpen(true)}>Details</Button>
            {!isViewer && !isCompleted && task.status === "approved" && (
              <Button size="sm" variant="outline" onClick={() => setChangingDate(true)}>
                <CalendarIcon className="mr-1 h-3 w-3" /> Change Date
              </Button>
            )}
            {/* Delete button - only creator can delete directly; others request deletion */}
            {!isViewer && !isCompleted && task.status !== "delete_requested" && (canDelete || canRequestDelete) && (
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">
              {canDelete ? "Are you sure you want to delete this task?" : "Request deletion? The task creator will need to approve."}
            </p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason for deletion..." className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={!comment}>
                {canDelete ? "Delete" : "Request Delete"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Delete approval - shown to task creator when someone else requests deletion */}
        {task.status === "delete_requested" && user?.id === task.assigneeId && (
          <div className="mt-4 space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-sm font-medium text-orange-800">
              Someone has requested to delete this task. Do you approve?
            </p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleApproveDelete}>Approve Delete</Button>
              <Button size="sm" variant="outline" onClick={handleRejectDelete}>Reject</Button>
            </div>
          </div>
        )}

        {/* Manager can also approve/reject delete requests */}
        {task.status === "delete_requested" && isManager && user?.id !== task.assigneeId && (
          <div className="mt-4 space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-sm font-medium text-orange-800">
              Deletion requested. Awaiting creator approval. As manager, you can also act.
            </p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleApproveDelete}>Approve Delete</Button>
              <Button size="sm" variant="outline" onClick={handleRejectDelete}>Reject</Button>
            </div>
          </div>
        )}

        {(!isViewer && isManager && task.status === "pending_approval") && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted p-3">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (required)..." className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAction("approved")} disabled={!comment} className="bg-emerald-600 text-white hover:bg-emerald-700">Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => handleAction("rejected")} disabled={!comment}>Reject</Button>
            </div>
          </div>
        )}

        {!isViewer && task.status === "approved" && isBssTeam && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted p-3">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment before starting..." className="text-sm" />
            <Button size="sm" onClick={() => handleAction("in_progress")} className="gap-1">
              <Play className="h-3 w-3" /> Start Working
            </Button>
          </div>
        )}

        {!isViewer && task.status === "in_progress" && isBssTeam && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted p-3">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add completion notes..." className="text-sm" />
            <Button size="sm" onClick={() => handleAction("bss_completed")} className="gap-1 bg-teal-600 text-white hover:bg-teal-700">
              <CheckCircle2 className="h-3 w-3" /> Mark BSS Complete
            </Button>
          </div>
        )}

        {!isViewer && task.status === "bss_completed" && user?.id === task.assigneeId && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted p-3">
            <p className="text-xs text-muted-foreground">BSS Team has completed their work. Please verify and mark as fully complete.</p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add verification notes..." className="text-sm" />
            <Button size="sm" onClick={() => handleAction("completed")} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Confirm Complete
            </Button>
          </div>
        )}

        {changingDate && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted p-3">
            <p className="text-sm font-medium text-foreground">Change Launch Date</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDate ? format(newDate, "PPP") : "Select new date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={newDate} onSelect={setNewDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason for date change..." className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleDateChange} disabled={!newDate}>Confirm Change</Button>
              <Button size="sm" variant="outline" onClick={() => setChangingDate(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <TaskDetailDialog task={task} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
};

const TaskDetailDialog: React.FC<{ task: Task; open: boolean; onOpenChange: (v: boolean) => void }> = ({ task, open, onOpenChange }) => {
  const sc = statusConfig[task.status];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{task.description}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Status:</span> <span className={cn("ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", sc.color)}>{sc.icon} {sc.label}</span></div>
            <div><span className="text-muted-foreground">Priority:</span> <Badge variant="outline" className={cn("ml-1", priorityColors[task.priority])}>{task.priority}</Badge></div>
            <div><span className="text-muted-foreground">Launch Date:</span> {format(new Date(task.assignedDate), "PPP")}</div>
            <div><span className="text-muted-foreground">Submitted:</span> {task.submittedDate}</div>
            <div><span className="text-muted-foreground">Assigned To:</span> {task.assignedTo}</div>
            <div><span className="text-muted-foreground">Assignee:</span> {task.assigneeName}</div>
          </div>

          <div className="space-y-3">
            <h4 className="flex items-center gap-2 font-display font-semibold text-foreground">
              <MessageSquare className="h-4 w-4" /> Activity Log
            </h4>
            <div className="space-y-2">
              {task.comments.map((c) => (
                <div key={c.id} className="flex gap-3 rounded-lg border border-border bg-muted p-3">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{c.userName}</span>
                      <span>•</span>
                      <span>{format(new Date(c.timestamp), "MMM d, h:mm a")}</span>
                      <Badge variant="outline" className="text-[10px]">{c.action}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskCard;
