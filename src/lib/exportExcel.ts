import * as XLSX from "xlsx";
import { Task } from "./types";

export const exportTasksToExcel = (tasks: Task[]) => {
  const rows = tasks.map((t) => ({
    "Task ID": t.id,
    "Title": t.title,
    "Description": t.description,
    "Status": t.status,
    "Priority": t.priority,
    "Launch Date": t.assignedDate,
    "Submitted Date": t.submittedDate,
    "Assigned To": t.assignedTo,
    "Assignee": t.assigneeName,
    "Needs Approval": t.needsApproval ? "Yes" : "No",
    "Created At": t.createdAt,
    "Last Activity": t.comments.length > 0 ? t.comments[t.comments.length - 1].timestamp : "",
    "Activity Log": t.comments.map((c) => `[${c.timestamp}] ${c.userName} (${c.action}): ${c.text}`).join("\n"),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = [
    { wch: 12 }, { wch: 30 }, { wch: 40 }, { wch: 16 }, { wch: 10 },
    { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
    { wch: 22 }, { wch: 22 }, { wch: 60 },
  ];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  XLSX.writeFile(wb, `BSS_Tasks_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
