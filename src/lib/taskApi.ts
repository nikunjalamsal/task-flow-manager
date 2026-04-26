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

const CATALOG_KEY = "cal_catalog";
const CATALOG_REQ_KEY = "cal_catalog_requests";

export const catalogApi = {
  async loadItems(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/catalog`);
      if (!res.ok) throw new Error();
      const items = await res.json();
      localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
      return items;
    } catch {
      const saved = localStorage.getItem(CATALOG_KEY);
      return saved ? JSON.parse(saved) : [];
    }
  },
  async saveItems(items: any[]): Promise<void> {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
    try {
      await fetch(`${API_BASE}/catalog`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
    } catch {}
  },
  async loadRequests(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/catalog-requests`);
      if (!res.ok) throw new Error();
      const reqs = await res.json();
      localStorage.setItem(CATALOG_REQ_KEY, JSON.stringify(reqs));
      return reqs;
    } catch {
      const saved = localStorage.getItem(CATALOG_REQ_KEY);
      return saved ? JSON.parse(saved) : [];
    }
  },
  async saveRequests(reqs: any[]): Promise<void> {
    localStorage.setItem(CATALOG_REQ_KEY, JSON.stringify(reqs));
    try {
      await fetch(`${API_BASE}/catalog-requests`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqs),
      });
    } catch {}
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

  async notifyTaskEvent(payload: {
    action: "added" | "edited" | "deleted";
    taskTitle: string;
    actorName: string;
    assignedDate?: string;
  }): Promise<void> {
    try {
      await fetch(`${API_BASE}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "task_event", ...payload }),
      });
    } catch {
      // Silent fail
    }
  },

  async notifyCatalogEvent(payload: {
    phase: "submitted" | "approved" | "rejected";
    requestType: "add" | "modify" | "delete" | "close";
    productName: string;
    requestedBy: string;
    reviewedBy?: string;
    reason?: string;
    comment?: string;
    changesMade?: string;
  }): Promise<void> {
    try {
      await fetch(`${API_BASE}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "catalog_event", ...payload }),
      });
    } catch {
      // Silent fail
    }
  },
};
