import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Task, TaskComment, TaskPriority, TaskStatus } from "@/lib/types";
import { taskApi, notifyApi } from "@/lib/taskApi";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { generateId } from "@/lib/utils";

const URGENCY_THRESHOLD_DAYS = 3;

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "comments" | "submittedDate" | "assignedTo" | "needsApproval" | "status" | "priority"> & { priority?: TaskPriority }) => { success: boolean; message: string };
  updateTaskStatus: (taskId: string, status: TaskStatus, userId: string, userName: string, comment: string) => void;
  changeTaskDate: (taskId: string, newDate: string, userId: string, userName: string, comment: string) => { success: boolean; message: string };
  editTask: (taskId: string, updates: { title?: string; description?: string }, userId: string, userName: string) => { success: boolean; message: string };
  deleteTask: (taskId: string, userId: string, userName: string, comment: string) => { success: boolean; message: string };
  approveDelete: (taskId: string, userId: string, userName: string, comment: string) => void;
  rejectDelete: (taskId: string, userId: string, userName: string, comment: string) => void;
  getTasksForDate: (date: string) => Task[];
  getTaskCountForDate: (date: string) => number;
  getPendingApprovalTasks: () => Task[];
  getAllTasks: () => Task[];
  refreshTasks: () => Promise<void>;
}

const TaskContext = createContext<TaskContextType | null>(null);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadFromServer = useCallback(async () => {
    const loaded = await taskApi.loadTasks();
    setTasks(loaded);
  }, []);

  useEffect(() => {
    loadFromServer();
    const interval = setInterval(loadFromServer, 10000);
    return () => clearInterval(interval);
  }, [loadFromServer]);

  const updateAndSave = useCallback((updater: (prev: Task[]) => Task[]) => {
    setTasks((prev) => {
      const next = updater(prev);
      taskApi.saveTasks(next);
      return next;
    });
  }, []);

  const getTasksForDate = useCallback((date: string) => tasks.filter((t) => t.assignedDate === date && t.status !== "rejected"), [tasks]);
  const getTaskCountForDate = useCallback((date: string) => tasks.filter((t) => t.assignedDate === date && t.status !== "rejected").length, [tasks]);
  const getPendingApprovalTasks = useCallback(() => tasks.filter((t) => t.status === "pending_approval" || t.status === "delete_requested"), [tasks]);
  const getAllTasks = useCallback(() => tasks, [tasks]);

  const addTask = useCallback(
    (taskInput: Omit<Task, "id" | "createdAt" | "comments" | "submittedDate" | "assignedTo" | "needsApproval" | "status" | "priority"> & { priority?: TaskPriority }) => {
      const today = startOfDay(new Date());
      const targetDate = startOfDay(new Date(taskInput.assignedDate));
      const daysDiff = differenceInCalendarDays(targetDate, today);
      const existingCount = tasks.filter((t) => t.assignedDate === taskInput.assignedDate && t.status !== "rejected").length;

      const isUrgent = daysDiff < URGENCY_THRESHOLD_DAYS;
      const needsApproval = isUrgent || existingCount >= 2;
      const priority: TaskPriority = isUrgent ? "high" : taskInput.priority || "medium";
      const status: TaskStatus = needsApproval ? "pending_approval" : "approved";

      const comment: TaskComment = {
        id: generateId(),
        userId: taskInput.assigneeId,
        userName: taskInput.assigneeName,
        text: needsApproval
          ? isUrgent
            ? `Task submitted with urgent deadline (< ${URGENCY_THRESHOLD_DAYS} days). Sent for manager approval.`
            : `Task submitted. Date already has ${existingCount} task(s). Sent for manager approval.`
          : "Task submitted and auto-approved.",
        action: "submitted",
        timestamp: new Date().toISOString(),
      };

      const newTask: Task = {
        ...taskInput,
        id: generateId(),
        submittedDate: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        assignedTo: "BSS Team",
        needsApproval,
        status,
        priority,
        comments: [comment],
        createdAt: new Date().toISOString(),
      };

      updateAndSave((prev) => [...prev, newTask]);

      // Send email notification to managers if approval is needed
      if (needsApproval) {
        notifyApi.notifyManagers();
      }

      // Notify BSS team + Managers about the new task (summary)
      notifyApi.notifyTaskEvent({
        action: "added",
        taskTitle: newTask.title,
        actorName: newTask.assigneeName,
        assignedDate: newTask.assignedDate,
      });

      return {
        success: true,
        message: needsApproval ? "Task sent for manager approval." : "Task auto-approved and added.",
      };
    },
    [tasks, updateAndSave]
  );

  const updateTaskStatus = useCallback(
    (taskId: string, status: TaskStatus, userId: string, userName: string, comment: string) => {
      const actionMap: Record<TaskStatus, TaskComment["action"]> = {
        pending_approval: "general",
        approved: "approved",
        rejected: "rejected",
        in_progress: "started",
        bss_completed: "bss_completed",
        completed: "completed",
        delete_requested: "delete_requested",
      };
      updateAndSave((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                comments: [
                  ...t.comments,
                  {
                    id: generateId(),
                    userId,
                    userName,
                    text: comment || `Status changed to ${status}`,
                    action: actionMap[status],
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            : t
        )
      );
    },
    [updateAndSave]
  );

  const editTask = useCallback(
    (taskId: string, updates: { title?: string; description?: string }, userId: string, userName: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return { success: false, message: "Task not found." };
      if (task.assigneeId !== userId) return { success: false, message: "Only the task owner can edit." };
      if (task.status === "completed") return { success: false, message: "Completed tasks cannot be edited." };

      const changes: string[] = [];
      if (updates.title && updates.title !== task.title) changes.push(`Title changed from "${task.title}" to "${updates.title}"`);
      if (updates.description && updates.description !== task.description) changes.push(`Description changed from "${task.description}" to "${updates.description}"`);
      if (changes.length === 0) return { success: false, message: "No changes made." };

      updateAndSave((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                ...(updates.title ? { title: updates.title } : {}),
                ...(updates.description ? { description: updates.description } : {}),
                comments: [
                  ...t.comments,
                  {
                    id: generateId(),
                    userId,
                    userName,
                    text: changes.join(". "),
                    action: "general" as const,
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            : t
        )
      );
      notifyApi.notifyTaskEvent({
        action: "edited",
        taskTitle: updates.title || task.title,
        actorName: userName,
        assignedDate: task.assignedDate,
      });
      return { success: true, message: "Task updated successfully." };
    },
    [tasks, updateAndSave]
  );

  const deleteTask = useCallback(
    (taskId: string, userId: string, userName: string, comment: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return { success: false, message: "Task not found." };

      // Completed tasks cannot be deleted
      if (task.status === "completed") {
        return { success: false, message: "Completed tasks cannot be deleted." };
      }

      const isCreator = task.assigneeId === userId;

      if (isCreator) {
        // Only the creator can delete directly
        updateAndSave((prev) => prev.filter((t) => t.id !== taskId));
        return { success: true, message: "Task deleted successfully." };
      } else {
        // Everyone else must request deletion approval from the creator
        updateAndSave((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "delete_requested" as TaskStatus,
                  comments: [
                    ...t.comments,
                    {
                      id: generateId(),
                      userId,
                      userName,
                      text: comment || `Deletion requested. Awaiting approval from ${task.assigneeName}.`,
                      action: "delete_requested" as const,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : t
          )
        );

        // Notify the task creator about the delete request
        const creatorUsername = task.assigneeId.replace("ldap-", "").replace("dummy-", "");
        notifyApi.notifyUser(creatorUsername);

        return { success: true, message: `Delete request sent to ${task.assigneeName} for approval.` };
      }
    },
    [tasks, updateAndSave]
  );

  const approveDelete = useCallback(
    (taskId: string, userId: string, userName: string, comment: string) => {
      updateAndSave((prev) => {
        const task = prev.find((t) => t.id === taskId);
        if (!task) return prev;
        // Log the approval, then remove
        taskApi.saveTasks(prev.map((t) =>
          t.id === taskId
            ? { ...t, comments: [...t.comments, { id: generateId(), userId, userName, text: comment || "Deletion approved.", action: "deleted" as const, timestamp: new Date().toISOString() }] }
            : t
        ));
        return prev.filter((t) => t.id !== taskId);
      });
    },
    [updateAndSave]
  );

  const rejectDelete = useCallback(
    (taskId: string, userId: string, userName: string, comment: string) => {
      updateAndSave((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "approved" as TaskStatus,
                comments: [
                  ...t.comments,
                  {
                    id: generateId(),
                    userId,
                    userName,
                    text: comment || "Deletion rejected. Task restored.",
                    action: "rejected" as const,
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            : t
        )
      );
    },
    [updateAndSave]
  );

  const changeTaskDate = useCallback(
    (taskId: string, newDate: string, userId: string, userName: string, comment: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return { success: false, message: "Task not found." };

      const isOwner = task.assigneeId === userId;
      const existingCount = tasks.filter((t) => t.assignedDate === newDate && t.status !== "rejected" && t.id !== taskId).length;
      const today = startOfDay(new Date());
      const targetDate = startOfDay(new Date(newDate));
      const daysDiff = differenceInCalendarDays(targetDate, today);

      // If not the owner, or urgent/overloaded date — require approval
      const needsApproval = !isOwner || daysDiff < URGENCY_THRESHOLD_DAYS || existingCount >= 2;

      if (needsApproval) {
        const reasonParts: string[] = [];
        if (!isOwner) reasonParts.push(`Date change requested by ${userName}. Awaiting owner (${task.assigneeName}) approval.`);
        if (daysDiff < URGENCY_THRESHOLD_DAYS) reasonParts.push("Urgent deadline.");
        if (existingCount >= 2) reasonParts.push(`Date already has ${existingCount} task(s).`);

        updateAndSave((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  assignedDate: newDate,
                  status: "pending_approval" as TaskStatus,
                  priority: daysDiff < URGENCY_THRESHOLD_DAYS ? "high" : t.priority,
                  needsApproval: true,
                  comments: [
                    ...t.comments,
                    {
                      id: generateId(),
                      userId,
                      userName,
                      text: comment || reasonParts.join(" ") || `Date changed to ${newDate}. Requires approval.`,
                      action: "date_changed" as const,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : t
          )
        );

        if (!isOwner) {
          const ownerUsername = task.assigneeId.replace("ldap-", "").replace("dummy-", "");
          notifyApi.notifyUser(ownerUsername);
        }
        notifyApi.notifyManagers();
        return { success: true, message: !isOwner ? `Date change sent to ${task.assigneeName} for approval.` : "Date changed. Requires manager approval." };
      }

      updateAndSave((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                assignedDate: newDate,
                comments: [
                  ...t.comments,
                  {
                    id: generateId(),
                    userId,
                    userName,
                    text: comment || `Date changed to ${newDate}.`,
                    action: "date_changed" as const,
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            : t
        )
      );
      return { success: true, message: "Date changed successfully." };
    },
    [tasks, updateAndSave]
  );

  return (
    <TaskContext.Provider
      value={{
        tasks,
        addTask,
        editTask,
        updateTaskStatus,
        changeTaskDate,
        deleteTask,
        approveDelete,
        rejectDelete,
        getTasksForDate,
        getTaskCountForDate,
        getPendingApprovalTasks,
        getAllTasks,
        refreshTasks: loadFromServer,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTasks must be used within TaskProvider");
  return ctx;
};