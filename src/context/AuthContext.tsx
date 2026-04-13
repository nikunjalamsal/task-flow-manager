import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { User } from "@/lib/types";

const USER_STORAGE_KEY = "cal_user";
const SESSION_ACTIVITY_KEY = "cal_user_last_activity";
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

const clearStoredSession = () => {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(SESSION_ACTIVITY_KEY);
};

const getStoredUser = (): User | null => {
  const savedUser = localStorage.getItem(USER_STORAGE_KEY);
  const lastActivity = Number(localStorage.getItem(SESSION_ACTIVITY_KEY) || "0");

  if (!savedUser || !lastActivity || Date.now() - lastActivity >= SESSION_TIMEOUT_MS) {
    clearStoredSession();
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    clearStoredSession();
    return null;
  }
};

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isManager: boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        const u: User = {
          id: data.user.id,
          name: data.user.name,
          username: data.user.username,
          password: "",
          role: data.user.role === "bss_team" ? "member" : data.user.role,
        };
        // Store bss_team flag separately so TaskContext can detect it
        const stored = { ...u, isBssTeam: data.user.role === "bss_team" };
        setUser(stored as User);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(stored));
        localStorage.setItem(SESSION_ACTIVITY_KEY, Date.now().toString());
        return { success: true };
      }

      return { success: false, error: data.error || "Authentication failed" };
    } catch (err: any) {
      return { success: false, error: "Cannot connect to server" };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearStoredSession();
  }, []);

  useEffect(() => {
    if (!user) return;

    const updateActivity = () => {
      localStorage.setItem(SESSION_ACTIVITY_KEY, Date.now().toString());
    };

    const validateSession = () => {
      const lastActivity = Number(localStorage.getItem(SESSION_ACTIVITY_KEY) || "0");
      if (!lastActivity || Date.now() - lastActivity >= SESSION_TIMEOUT_MS) {
        logout();
      }
    };

    const syncAcrossTabs = () => {
      if (!localStorage.getItem(USER_STORAGE_KEY)) {
        setUser(null);
        return;
      }
      validateSession();
    };

    const activityEvents: Array<keyof WindowEventMap> = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, updateActivity, { passive: true }));
    window.addEventListener("storage", syncAcrossTabs);

    const intervalId = window.setInterval(validateSession, 1000);
    updateActivity();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, updateActivity));
      window.removeEventListener("storage", syncAcrossTabs);
      window.clearInterval(intervalId);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isManager: user?.role === "manager", isViewer: user?.role === "viewer" }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
