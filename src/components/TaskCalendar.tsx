import React, { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTasks } from "@/context/TaskContext";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, addMonths, subMonths, differenceInCalendarDays, startOfDay, isBefore } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import TaskCard from "./TaskCard";
import TaskForm from "./TaskForm";

const URGENCY_THRESHOLD_DAYS = 3;

const TaskCalendar: React.FC = () => {
  const { user, isManager, isViewer } = useAuth();
  const { tasks, getTaskCountForDate } = useTasks();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskFormDate, setTaskFormDate] = useState<Date | undefined>();

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter((t) => t.assignedDate === selectedDate && t.status !== "rejected");
  }, [selectedDate, tasks]);

  const getDayClass = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const count = getTaskCountForDate(dateStr);
    const today = startOfDay(new Date());
    const daysDiff = differenceInCalendarDays(startOfDay(day), today);

    if (daysDiff >= 0 && daysDiff < URGENCY_THRESHOLD_DAYS && isSameMonth(day, currentMonth)) {
      return "cal-day-red";
    }

    if (count === 1) return "cal-day-green";
    if (count === 2) return "cal-day-yellow";
    if (count > 2) return "cal-day-red";
    return "";
  };

  const handleDoubleClick = (day: Date) => {
    // Viewers cannot add tasks at all
    if (isViewer) return;
    // Regular members cannot add tasks for past dates
    const canSelectPast = isManager || user?.id === "bss-1";
    if (!canSelectPast && isBefore(startOfDay(day), startOfDay(new Date()))) {
      return;
    }
    setTaskFormDate(day);
    setTaskFormOpen(true);
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          <Button size="icon" variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm cal-day-green" /> 1 Task</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm cal-day-yellow" /> 2 Tasks</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm cal-day-red" /> 3+ Tasks / Urgent</span>
        <span className="text-muted-foreground ml-2">💡 Double-click a date to add a task</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-7">
          {weekDays.map((d) => (
            <div key={d} className="border-b border-border bg-muted px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const count = getTaskCountForDate(dateStr);
            const dayClass = getDayClass(day);
            const isSelected = selectedDate === dateStr;
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                onDoubleClick={() => handleDoubleClick(day)}
                className={cn(
                  "relative min-h-[80px] border-b border-r border-border p-2 text-left transition-all hover:bg-accent/50",
                  !isCurrentMonth && "opacity-30",
                  isSelected && "ring-2 ring-primary ring-inset",
                  isToday(day) && "font-bold",
                  dayClass
                )}
              >
                <span className={cn("text-sm", isToday(day) && "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground")}>
                  {format(day, "d")}
                </span>
                {count > 0 && isCurrentMonth && (
                  <div className="mt-1 space-y-0.5">
                    {tasks
                      .filter((t) => t.assignedDate === dateStr && t.status !== "rejected")
                      .slice(0, 2)
                      .map((t) => (
                        <div key={t.id} className="truncate rounded bg-card/80 px-1 py-0.5 text-[10px] font-medium text-card-foreground shadow-sm border border-border">
                          {t.title}
                        </div>
                      ))}
                    {count > 2 && <div className="text-[10px] text-muted-foreground">+{count - 2} more</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="animate-fade-in space-y-4">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Tasks for {format(new Date(selectedDate), "MMMM d, yyyy")}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""})</span>
          </h3>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks scheduled for this date.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {selectedTasks.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hidden TaskForm triggered by double-click */}
      <TaskForm
        preSelectedDate={taskFormDate}
        externalOpen={taskFormOpen}
        onExternalOpenChange={setTaskFormOpen}
      />
    </div>
  );
};

export default TaskCalendar;