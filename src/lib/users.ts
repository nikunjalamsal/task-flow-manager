import { User } from "./types";

export const USERS: User[] = [
  { id: "mgr-1", name: "Rajesh Kumar (Manager)", username: "rajesh", password: "manager@123", role: "manager" },
  { id: "bss-1", name: "BSS Team", username: "bssteam", password: "bss@123", role: "member" },
  { id: "mem-1", name: "Alice Sharma", username: "alice", password: "alice@123", role: "member" },
  { id: "mem-2", name: "Bob Patel", username: "bob", password: "bob@123", role: "member" },
  { id: "mem-3", name: "Charlie Singh", username: "charlie", password: "charlie@123", role: "member" },
  { id: "mem-4", name: "Diana Gupta", username: "diana", password: "diana@123", role: "member" },
  { id: "vwr-1", name: "Viewer User", username: "viewer", password: "viewer@123", role: "viewer" },
];

export const findUser = (username: string, password: string): User | undefined =>
  USERS.find((u) => u.username === username && u.password === password);
