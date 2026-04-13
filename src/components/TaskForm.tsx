import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTasks } from "@/context/TaskContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInCalendarDays, startOfDay, isBefore } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const URGENCY_THRESHOLD_DAYS = 3;

interface TaskFormProps {
  preSelectedDate?: Date;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ preSelectedDate, externalOpen, onExternalOpenChange }) => {
  const { user, isManager } = useAuth();
  const { addTask, getTaskCountForDate } = useTasks();
  const [internalOpen, setInternalOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(preSelectedDate);
  const [priority, setPriority] = useState<string>("medium");

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onExternalOpenChange || setInternalOpen;

  // Sync preSelectedDate when it changes
  React.useEffect(() => {
    if (preSelectedDate) setDate(preSelectedDate);
  }, [preSelectedDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !date) return;

    const dateStr = format(date, "yyyy-MM-dd");
    const result = addTask({
      title,
      description,
      assignedDate: dateStr,
      assigneeId: user.id,
      assigneeName: user.name,
      priority: priority as "low" | "medium" | "high",
    });

    toast[result.message.includes("approval") ? "info" : "success"](result.message);
    setOpen(false);
    setTitle("");
    setDescription("");
    setDate(undefined);
    setPriority("medium");
  };

  const getDateHint = () => {
    if (!date) return null;
    const daysDiff = differenceInCalendarDays(startOfDay(date), startOfDay(new Date()));
    const count = getTaskCountForDate(format(date, "yyyy-MM-dd"));

    const hints: string[] = [];
    if (daysDiff < URGENCY_THRESHOLD_DAYS) hints.push(`⚠️ Less than ${URGENCY_THRESHOLD_DAYS} days — requires manager approval, priority set to High`);
    if (count >= 2) hints.push(`⚠️ ${count} task(s) already on this date — requires manager approval`);
    if (count === 1) hints.push("ℹ️ 1 task already on this date");
    if (hints.length === 0 && daysDiff >= URGENCY_THRESHOLD_DAYS) hints.push(`✅ Auto-approved (date is ${URGENCY_THRESHOLD_DAYS}+ days away, fewer than 2 tasks)`);
    return hints;
  };

  const dateHints = getDateHint();

  const isExternal = externalOpen !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isExternal && (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Task Request
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Submit Task Request</DialogTitle>
          <DialogDescription>Request will be assigned to BSS Team. Submitted by {user?.name}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Task Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deploy API changes" required maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the task..." required maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label>Submitted Date</Label>
            <Input value={format(new Date(), "yyyy-MM-dd HH:mm:ss")} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Launch Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a launch date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    if (d) setCalendarOpen(false);
                  }}
                  disabled={
                    (!isManager && user?.id !== "bss-1")
                      ? (d) => isBefore(startOfDay(d), startOfDay(new Date()))
                      : undefined
                  }
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {dateHints && (
              <div className="space-y-1">
                {dateHints.map((h, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{h}</p>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            {date && differenceInCalendarDays(startOfDay(date), startOfDay(new Date())) < URGENCY_THRESHOLD_DAYS && (
              <p className="text-xs text-destructive">Priority will be set to High (urgent deadline)</p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted p-3 text-sm">
            <p><span className="text-muted-foreground">Assigned To:</span> BSS Team</p>
            <p><span className="text-muted-foreground">Submitted By:</span> {user?.name}</p>
          </div>
          <Button type="submit" className="w-full" disabled={!date || !title}>
            Submit Request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskForm;
