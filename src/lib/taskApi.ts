import { Task } from "./types";

const API_BASE = "/api";
const STORAGE_KEY = "cal_tasks";

export const taskApi = {
  async loadTasks(): Promise<Task[]> {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const tasks = await res.json();
      // Keep localStorage in sync as backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return tasks;
    } catch {
      // Fallback to localStorage when server is unavailable (e.g. Lovable preview)
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    }
  },

  async saveTasks(tasks: Task[]): Promise<void> {
    // Always save to localStorage first so data is never lost
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    try {
      await fetch(`${API_BASE}/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasks),
      });
    } catch {
      // Server unavailable — localStorage already has the data
    }
  },
};

export const notifyApi = {
  async notifyManagers(): Promise<void> {
    try {
      await fetch(`${API_BASE}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manager" }),
      });
    } catch {
      // Silent fail — notification is best-effort
    }
  },

  async notifyUser(username: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "user", username }),
      });
    } catch {
      // Silent fail
    }
  },
};
