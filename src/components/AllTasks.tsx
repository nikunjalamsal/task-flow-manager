import React from "react";
import { useTasks } from "@/context/TaskContext";
import { useAuth } from "@/context/AuthContext";
import TaskCard from "./TaskCard";
import { ClipboardList } from "lucide-react";

const AllTasks: React.FC = () => {
  const { tasks } = useTasks();
  const { isManager, user } = useAuth();

  // All tasks are visible to all users
  const sorted = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold text-foreground">
          All Tasks
        </h2>
        <span className="text-sm text-muted-foreground">({sorted.length})</span>
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No tasks yet. Create your first task request!</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sorted.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AllTasks;
