export type UserRole = "member" | "manager" | "viewer";

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: UserRole;
}

export type TaskStatus = "pending_approval" | "approved" | "in_progress" | "bss_completed" | "completed" | "rejected" | "delete_requested";
export type TaskPriority = "low" | "medium" | "high";

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  action: "submitted" | "approved" | "rejected" | "started" | "bss_completed" | "completed" | "date_changed" | "general" | "delete_requested" | "deleted";
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedDate: string;
  submittedDate: string;
  assignedTo: string;
  assigneeId: string;
  assigneeName: string;
  priority: TaskPriority;
  status: TaskStatus;
  needsApproval: boolean;
  comments: TaskComment[];
  createdAt: string;
}
