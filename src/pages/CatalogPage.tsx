import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCatalog } from "@/context/CatalogContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  LogOut,
  Shield,
  BookOpen,
  CheckCircle2,
  XCircle,
  Lock,
  Search,
  History,
  Filter,
  Download,
  Database,
  Phone,
  MessageSquare,
  Infinity as InfinityIcon,
  Hash,
  Link2,
  PlusCircle,
  PencilLine,
  XCircle as XCircleIcon,
} from "lucide-react";
import { CatalogItem, CatalogResource, CatalogChangeLog } from "@/lib/catalogTypes";
import { exportCatalogToExcel } from "@/lib/exportCatalogExcel";
import { toast } from "sonner";

const emptyItem = (owner = ""): CatalogItem => ({
  id: "",
  sn: 0,
  productName: "",
  productType: "Onetime",
  productId: "",
  productCode: "",
  productPrice: 0,
  resources: [{ subAccountId: "", subAccountName: "", resource: "" }],
  productValidity: "",
  liveDate: "",
  channelOpenTo: "All",
  productOwner: owner,
  closeDate: "",
  changesDate: "",
  changesMade: "",
  changeMadeBy: "",
  changeDetail: "",
  changeLog: [],
  createdAt: new Date().toISOString(),
  status: "live",
});

// Required-field label helper (red asterisk)
const RField: React.FC<{ label: string; children: React.ReactNode; className?: string; required?: boolean }> = ({
  label,
  children,
  className,
  required = true,
}) => (
  <div className={`space-y-1 ${className || ""}`}>
    <Label className="text-xs">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    {children}
  </div>
);

// Free-form numeric price input (no spinner buttons)
const PriceInput: React.FC<{ value: number; onChange: (n: number) => void }> = ({ value, onChange }) => {
  const [text, setText] = useState<string>(value ? String(value) : "");
  React.useEffect(() => {
    setText(value ? String(value) : "");
  }, [value]);
  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        Rs.
      </span>
      <Input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*\.?[0-9]*"
        className="pl-9"
        value={text}
        placeholder="0"
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, "");
          // allow only one dot
          const parts = v.split(".");
          const cleaned = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : v;
          setText(cleaned);
          const n = Number(cleaned);
          onChange(isNaN(n) ? 0 : n);
        }}
      />
    </div>
  );
};

// ----- Resource display in the table: clean chips -----
const isLink = (s: string) => /^(https?:\/\/|www\.)/i.test(s.trim());

const resourceTone = (name: string): { bg: string; text: string; icon: React.ReactNode } => {
  const n = (name || "").toLowerCase();
  if (n.includes("data")) return { bg: "bg-sky-100", text: "text-sky-800", icon: <Database className="h-3 w-3" /> };
  if (n.includes("voice")) return { bg: "bg-violet-100", text: "text-violet-800", icon: <Phone className="h-3 w-3" /> };
  if (n.includes("sms")) return { bg: "bg-amber-100", text: "text-amber-800", icon: <MessageSquare className="h-3 w-3" /> };
  if (n.includes("unlim")) return { bg: "bg-emerald-100", text: "text-emerald-800", icon: <InfinityIcon className="h-3 w-3" /> };
  return { bg: "bg-slate-100", text: "text-slate-800", icon: <Hash className="h-3 w-3" /> };
};

const ResourceList: React.FC<{ resources: CatalogResource[] }> = ({ resources }) => {
  if (!resources || resources.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="flex flex-col gap-1 min-w-[220px] max-w-[320px]">
      {resources.map((r, i) => {
        const tone = resourceTone(r.subAccountName);
        return (
          <li
            key={i}
            className={`flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-[11px]`}
          >
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${tone.bg} ${tone.text}`}>
              {tone.icon}
              {r.subAccountName || "—"}
            </span>
            {r.subAccountId && (
              <span className="font-mono text-[10px] text-muted-foreground">#{r.subAccountId}</span>
            )}
            <span className="ml-auto font-mono text-foreground break-all">
              {isLink(r.resource) ? (
                <a
                  href={r.resource.startsWith("http") ? r.resource : `https://${r.resource}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Link2 className="h-3 w-3" /> Link
                </a>
              ) : (
                r.resource || "—"
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

// ----- Resource editor used in Add/Modify dialogs -----
const ResourceEditor: React.FC<{
  resources: CatalogResource[];
  onUpdate: (idx: number, patch: Partial<CatalogResource>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}> = ({ resources, onUpdate, onAdd, onRemove }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label>
        Product Resources <span className="text-destructive">*</span>
      </Label>
      <Button size="sm" variant="outline" onClick={onAdd} className="gap-1 h-7 px-2">
        <Plus className="h-3 w-3" /> Add resource
      </Button>
    </div>
    <div className="space-y-2">
      {resources.map((r, i) => {
        const tone = resourceTone(r.subAccountName);
        return (
          <div
            key={i}
            className="rounded-lg border border-border bg-muted/30 p-2"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
                {tone.icon}
                {r.subAccountName || `Resource #${i + 1}`}
              </span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onRemove(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3">
                <Label className="text-[11px]">
                  Sub a/c id <span className="text-destructive">*</span>
                </Label>
                <Input value={r.subAccountId} onChange={(e) => onUpdate(i, { subAccountId: e.target.value })} />
              </div>
              <div className="col-span-4">
                <Label className="text-[11px]">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={r.subAccountName}
                  placeholder="e.g. Data, Voice, SMS"
                  onChange={(e) => onUpdate(i, { subAccountName: e.target.value })}
                />
              </div>
              <div className="col-span-5">
                <Label className="text-[11px]">
                  Value or Link <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={r.resource}
                  placeholder="e.g. 104857600 or https://…"
                  onChange={(e) => onUpdate(i, { resource: e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ----- History timeline dialog -----
const actionMeta: Record<NonNullable<CatalogChangeLog["action"]>, { label: string; tone: string; icon: React.ReactNode }> = {
  added: { label: "ADDED", tone: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <PlusCircle className="h-3.5 w-3.5" /> },
  modified: { label: "MODIFIED", tone: "bg-amber-100 text-amber-700 border-amber-200", icon: <PencilLine className="h-3.5 w-3.5" /> },
  closed: { label: "CLOSED", tone: "bg-slate-200 text-slate-700 border-slate-300", icon: <Lock className="h-3.5 w-3.5" /> },
  deleted: { label: "DELETED", tone: "bg-red-100 text-red-700 border-red-200", icon: <XCircleIcon className="h-3.5 w-3.5" /> },
};

const HistoryDialog: React.FC<{ item: CatalogItem }> = ({ item }) => {
  const [open, setOpen] = useState(false);
  const log = [...item.changeLog].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs">
          <History className="h-3 w-3" /> History {log.length > 0 && <span className="text-muted-foreground">({log.length})</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Change History — {item.productName}
          </DialogTitle>
          <DialogDescription>Each entry below represents a single approved change, in reverse chronological order.</DialogDescription>
        </DialogHeader>
        {log.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No history yet.
          </div>
        ) : (
          <ol className="relative border-l-2 border-border ml-3 space-y-4 pl-5">
            {log.map((entry) => {
              const meta = entry.action ? actionMeta[entry.action] : actionMeta.modified;
              return (
                <li key={entry.id} className="relative">
                  <span className={`absolute -left-[31px] top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border ${meta.tone}`}>
                    {meta.icon}
                  </span>
                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold border ${meta.tone}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{new Date(entry.date).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px]">
                      <div><span className="text-muted-foreground">Requested by:</span> <span className="font-medium">{entry.requestedBy}</span></div>
                      <div><span className="text-muted-foreground">Approved by:</span> <span className="font-medium">{entry.changeMadeBy}</span></div>
                    </div>
                    {entry.fieldChanges && entry.fieldChanges.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Field changes</p>
                        <ul className="space-y-0.5">
                          {entry.fieldChanges.map((c, i) => (
                            <li key={i} className="text-[12px]">
                              <span className="font-medium">{c.label}:</span>{" "}
                              <span className="line-through text-muted-foreground">{c.from || "(empty)"}</span>
                              {" → "}
                              <span className="font-semibold text-foreground">{c.to || "(empty)"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {entry.resourceChanges && entry.resourceChanges.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Resource changes</p>
                        <ul className="space-y-0.5">
                          {entry.resourceChanges.map((c, i) => (
                            <li key={i} className="text-[12px] font-mono">
                              <span className="font-semibold">{c.label}:</span>{" "}
                              <span className="line-through text-muted-foreground">{c.from || "(empty)"}</span>
                              {" → "}
                              <span className="font-semibold text-foreground">{c.to || "(empty)"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {entry.description && (
                      <div className="mt-2 text-[12px]">
                        <span className="text-muted-foreground">Note:</span> <span className="whitespace-pre-wrap">{entry.description}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CatalogPage: React.FC = () => {
  const { user, logout, isManager } = useAuth();
  const { items, requests, submitRequest, approveRequest, rejectRequest } = useCatalog();

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground leading-tight">Product Catalog</h1>
              <p className="text-xs text-muted-foreground">Catalog Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> <CalendarDays className="h-3.5 w-3.5" /> Task Calendar
              </Button>
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{isManager ? "Manager" : "User"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={logout} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <Tabs defaultValue="catalog">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList>
              <TabsTrigger value="catalog">Catalog</TabsTrigger>
              <TabsTrigger value="approvals" className="gap-1.5 relative">
                <Shield className="h-3.5 w-3.5" /> Catalog Approvals
                {pendingRequests.length > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => exportCatalogToExcel(items)}
                disabled={items.length === 0}
              >
                <Download className="h-4 w-4" /> Export Excel
              </Button>
              <AddDialog
                existingItems={items}
                defaultOwner={user?.name || ""}
                onSubmit={(draft, reason) => {
                  if (!user) return;
                  const result = submitRequest({
                    type: "add",
                    draft,
                    reason,
                    requestedBy: user.name,
                    requestedById: user.id,
                  });
                  if (result.success) toast.success(result.message);
                  else toast.error(result.message);
                }}
              />
            </div>
          </div>

          <TabsContent value="catalog" className="mt-6">
            <CatalogTable
              items={items}
              onModify={(item, draft, reason) => {
                if (!user) return;
                const result = submitRequest({
                  type: "modify",
                  itemId: item.id,
                  draft,
                  reason,
                  requestedBy: user.name,
                  requestedById: user.id,
                });
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              }}
              onDelete={(item, reason) => {
                if (!user) return;
                const result = submitRequest({
                  type: "delete",
                  itemId: item.id,
                  reason,
                  requestedBy: user.name,
                  requestedById: user.id,
                });
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              }}
              onClose={(item, reason) => {
                if (!user) return;
                const result = submitRequest({
                  type: "close",
                  itemId: item.id,
                  reason,
                  requestedBy: user.name,
                  requestedById: user.id,
                });
                if (result.success) toast.success(result.message);
                else toast.error(result.message);
              }}
            />
          </TabsContent>

          <TabsContent value="approvals" className="mt-6">
            <ApprovalsList
              requests={requests}
              isManager={!!isManager}
              items={items}
              onApprove={(id, comment) => {
                if (!user) return;
                approveRequest(id, user.name, comment);
                toast.success("Request approved.");
              }}
              onReject={(id, comment) => {
                if (!user) return;
                rejectRequest(id, user.name, comment);
                toast.success("Request rejected.");
              }}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// ----- Catalog Table -----
const CatalogTable: React.FC<{
  items: CatalogItem[];
  onModify: (item: CatalogItem, draft: CatalogItem, reason: string) => void;
  onDelete: (item: CatalogItem, reason: string) => void;
  onClose: (item: CatalogItem, reason: string) => void;
}> = ({ items, onModify, onDelete, onClose }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const productTypes = useMemo(
    () => Array.from(new Set(items.map((i) => i.productType).filter(Boolean))),
    [items]
  );
  const channels = useMemo(
    () => Array.from(new Set(items.map((i) => i.channelOpenTo).filter(Boolean))),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const status = it.status || "live";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (typeFilter !== "all" && it.productType !== typeFilter) return false;
      if (channelFilter !== "all" && it.channelOpenTo !== channelFilter) return false;
      if (!q) return true;
      const haystack = [
        it.productName,
        it.productType,
        it.productId,
        it.productCode,
        String(it.productPrice),
        it.productValidity,
        it.liveDate,
        it.channelOpenTo,
        it.closeDate,
        it.changesMade,
        it.changeMadeBy,
        ...it.resources.flatMap((r) => [r.subAccountId, r.subAccountName, r.resource]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, statusFilter, typeFilter, channelFilter]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label className="text-xs flex items-center gap-1 mb-1"><Search className="h-3 w-3" /> Search</Label>
          <Input
            placeholder="Search any field…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-[150px]">
          <Label className="text-xs flex items-center gap-1 mb-1"><Filter className="h-3 w-3" /> Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[160px]">
          <Label className="text-xs mb-1 block">Product Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {productTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[160px]">
          <Label className="text-xs mb-1 block">Channel</Label>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {channels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {items.length} items
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          No catalog items match the filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/60 text-left sticky top-0">
              <tr>
                <Th>SN</Th>
                <Th>Status</Th>
                <Th>Product Name</Th>
                <Th>Type</Th>
                <Th>Product ID</Th>
                <Th>Code</Th>
                <Th className="text-right">Price</Th>
                <Th>Resources</Th>
                <Th>Validity</Th>
                <Th>Live Date</Th>
                <Th>Channel</Th>
                <Th>Product Owner</Th>
                <Th>Close Date</Th>
                <Th>Changes Date</Th>
                <Th>Changes Made</Th>
                <Th>Change By</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const isClosed = (it.status || "live") === "closed";
                return (
                  <tr
                    key={it.id}
                    className={`border-t border-border align-top transition-colors ${
                      isClosed
                        ? "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                        : "bg-emerald-500/5 hover:bg-emerald-500/10"
                    }`}
                  >
                    <Td><span className="font-semibold">{it.sn}</span></Td>
                    <Td>
                      {isClosed ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30">
                          <Lock className="h-3 w-3 mr-1" /> Closed
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">● Live</Badge>
                      )}
                    </Td>
                    <Td><span className="font-medium text-foreground">{it.productName}</span></Td>
                    <Td><Badge variant="outline" className="font-normal">{it.productType}</Badge></Td>
                    <Td className="font-mono text-[11px]">{it.productId}</Td>
                    <Td className="font-mono text-[11px]">{it.productCode}</Td>
                    <Td className="text-right font-semibold tabular-nums">{it.productPrice}</Td>
                    <Td><ResourceList resources={it.resources} /></Td>
                    <Td>{it.productValidity}</Td>
                    <Td className="whitespace-nowrap">{it.liveDate}</Td>
                    <Td><Badge variant="secondary" className="font-normal">{it.channelOpenTo}</Badge></Td>
                    <Td className="whitespace-nowrap">{it.productOwner || "—"}</Td>
                    <Td className="whitespace-nowrap">{it.closeDate || "—"}</Td>
                    <Td className="whitespace-nowrap">{it.changesDate || "—"}</Td>
                    <Td><div className="max-w-[260px] whitespace-pre-wrap text-[11px]">{it.changesMade || "—"}</div></Td>
                    <Td>{it.changeMadeBy || "—"}</Td>
                    <Td>
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        {!isClosed && (
                          <ModifyDialog
                            item={it}
                            existingItems={items}
                            onSubmit={(draft, reason) => onModify(it, draft, reason)}
                          />
                        )}
                        {!isClosed && (
                          <CloseDialog item={it} onConfirm={(reason) => onClose(it, reason)} />
                        )}
                        <DeleteDialog item={it} onConfirm={(reason) => onDelete(it, reason)} />
                        <HistoryDialog item={it} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <th className={`px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground border-b border-border whitespace-nowrap ${className || ""}`}>{children}</th>
);
const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <td className={`px-2 py-2 text-xs ${className || ""}`}>{children}</td>
);

// Reusable select that supports defining a new option inline
const OptionSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}> = ({ value, onChange, options, placeholder }) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const opts = Array.from(new Set([...(options || []), value].filter(Boolean)));

  if (adding) {
    return (
      <div className="flex gap-1">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Define new value"
        />
        <Button
          size="sm"
          onClick={() => {
            const v = draft.trim();
            if (!v) return toast.error("Enter a value");
            onChange(v);
            setAdding(false);
            setDraft("");
          }}
        >
          OK
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}>×</Button>
      </div>
    );
  }
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => {
        if (v === "__add_new__") setAdding(true);
        else onChange(v);
      }}
    >
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value="__add_new__" className="text-primary font-medium">+ Define new…</SelectItem>
      </SelectContent>
    </Select>
  );
};

// ----- Add Dialog -----
const AddDialog: React.FC<{
  onSubmit: (draft: CatalogItem, reason: string) => void;
  existingItems: CatalogItem[];
  defaultOwner: string;
}> = ({ onSubmit, existingItems, defaultOwner }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogItem>(() => emptyItem(defaultOwner));
  const [reason, setReason] = useState("");

  React.useEffect(() => {
    if (open) {
      setDraft(emptyItem(defaultOwner));
      setReason("");
    }
  }, [open, defaultOwner]);

  const productTypes = useMemo(
    () => Array.from(new Set(["Onetime", "Renewal", "Saapati", ...existingItems.map((i) => i.productType)])),
    [existingItems]
  );
  const channels = useMemo(
    () => Array.from(new Set(["All", "USSD", "App", "Web", ...existingItems.map((i) => i.channelOpenTo)])),
    [existingItems]
  );

  const update = (patch: Partial<CatalogItem>) => setDraft((d) => ({ ...d, ...patch }));
  const updateResource = (idx: number, patch: Partial<CatalogResource>) =>
    setDraft((d) => ({ ...d, resources: d.resources.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  const addResource = () =>
    setDraft((d) => ({ ...d, resources: [...d.resources, { subAccountId: "", subAccountName: "", resource: "" }] }));
  const removeResource = (idx: number) =>
    setDraft((d) => ({ ...d, resources: d.resources.filter((_, i) => i !== idx) }));

  const handleSubmit = () => {
    if (!draft.productName.trim()) return toast.error("Product Name is required");
    if (!draft.productType.trim()) return toast.error("Product Type is required");
    if (!draft.productId.trim()) return toast.error("Product ID is required");
    if (!draft.productCode.trim()) return toast.error("Product Code is required");
    if (!draft.productPrice || draft.productPrice <= 0) return toast.error("Product Price is required");
    if (!draft.productValidity.trim()) return toast.error("Product Validity is required");
    if (!draft.liveDate.trim()) return toast.error("Live Date is required");
    if (!draft.channelOpenTo.trim()) return toast.error("Channel is required");
    if (!(draft.productOwner || "").trim()) return toast.error("Product Owner is required");
    if (draft.resources.length === 0) return toast.error("Add at least one resource");
    for (const r of draft.resources) {
      if (!r.subAccountId.trim() || !r.subAccountName.trim() || !r.resource.trim()) {
        return toast.error("All resource fields (Sub a/c id, Name, Value/Link) are required");
      }
    }
    if (!reason.trim()) return toast.error("Reason is required for approval");
    onSubmit(draft, reason);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Request Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request New Catalog Item</DialogTitle>
          <DialogDescription>
            Fill in the product details. Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RField label="Product Name"><Input value={draft.productName} onChange={(e) => update({ productName: e.target.value })} /></RField>
          <RField label="Product Type">
            <OptionSelect value={draft.productType} onChange={(v) => update({ productType: v })} options={productTypes} />
          </RField>
          <RField label="Product ID"><Input value={draft.productId} onChange={(e) => update({ productId: e.target.value })} /></RField>
          <RField label="Product Code"><Input value={draft.productCode} onChange={(e) => update({ productCode: e.target.value })} /></RField>
          <RField label="Product Price"><PriceInput value={draft.productPrice} onChange={(n) => update({ productPrice: n })} /></RField>
          <RField label="Product Validity"><Input value={draft.productValidity} onChange={(e) => update({ productValidity: e.target.value })} placeholder="e.g. 30 day" /></RField>
          <RField label="Live Date"><Input type="date" value={draft.liveDate} onChange={(e) => update({ liveDate: e.target.value })} /></RField>
          <RField label="Channel Open to">
            <OptionSelect value={draft.channelOpenTo} onChange={(v) => update({ channelOpenTo: v })} options={channels} />
          </RField>
          <RField label="Product Owner" className="sm:col-span-2">
            <Input value={draft.productOwner || ""} onChange={(e) => update({ productOwner: e.target.value })} placeholder="Defaults to logged-in user" />
          </RField>
        </div>

        <ResourceEditor
          resources={draft.resources}
          onUpdate={updateResource}
          onAdd={addResource}
          onRemove={removeResource}
        />

        <RField label="Reason / Description for approval">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this product needs to be added..." rows={3} />
        </RField>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Submit for Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----- Modify Dialog -----
const ModifyDialog: React.FC<{
  item: CatalogItem;
  existingItems: CatalogItem[];
  onSubmit: (draft: CatalogItem, reason: string) => void;
}> = ({ item, existingItems, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogItem>(item);
  const [reason, setReason] = useState("");

  React.useEffect(() => {
    if (open) {
      setDraft({ ...item, resources: item.resources.map((r) => ({ ...r })) });
      setReason("");
    }
  }, [open, item]);

  const productTypes = useMemo(
    () => Array.from(new Set(["Onetime", "Renewal", "Saapati", ...existingItems.map((i) => i.productType)])),
    [existingItems]
  );
  const channels = useMemo(
    () => Array.from(new Set(["All", "USSD", "App", "Web", ...existingItems.map((i) => i.channelOpenTo)])),
    [existingItems]
  );

  const update = (patch: Partial<CatalogItem>) => setDraft((d) => ({ ...d, ...patch }));
  const updateResource = (idx: number, patch: Partial<CatalogResource>) =>
    setDraft((d) => ({ ...d, resources: d.resources.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  const addResource = () =>
    setDraft((d) => ({ ...d, resources: [...d.resources, { subAccountId: "", subAccountName: "", resource: "" }] }));
  const removeResource = (idx: number) =>
    setDraft((d) => ({ ...d, resources: d.resources.filter((_, i) => i !== idx) }));

  const handleSubmit = () => {
    if (!draft.productName.trim()) return toast.error("Product Name is required");
    if (!draft.productType.trim()) return toast.error("Product Type is required");
    if (!draft.productId.trim()) return toast.error("Product ID is required");
    if (!draft.productCode.trim()) return toast.error("Product Code is required");
    if (!draft.productPrice || draft.productPrice <= 0) return toast.error("Product Price is required");
    if (!draft.productValidity.trim()) return toast.error("Product Validity is required");
    if (!draft.liveDate.trim()) return toast.error("Live Date is required");
    if (!draft.channelOpenTo.trim()) return toast.error("Channel is required");
    if (!(draft.productOwner || "").trim()) return toast.error("Product Owner is required");
    if (draft.resources.length === 0) return toast.error("Add at least one resource");
    for (const r of draft.resources) {
      if (!r.subAccountId.trim() || !r.subAccountName.trim() || !r.resource.trim()) {
        return toast.error("All resource fields (Sub a/c id, Name, Value/Link) are required");
      }
    }
    if (!reason.trim()) return toast.error("Reason is required for approval");
    onSubmit(draft, reason);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs">
          <Pencil className="h-3 w-3" /> Modify
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Modification</DialogTitle>
          <DialogDescription>
            Editing <span className="font-semibold">{item.productName}</span>. Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RField label="Product Name"><Input value={draft.productName} onChange={(e) => update({ productName: e.target.value })} /></RField>
          <RField label="Product Type">
            <OptionSelect value={draft.productType} onChange={(v) => update({ productType: v })} options={productTypes} />
          </RField>
          <RField label="Product ID"><Input value={draft.productId} onChange={(e) => update({ productId: e.target.value })} /></RField>
          <RField label="Product Code"><Input value={draft.productCode} onChange={(e) => update({ productCode: e.target.value })} /></RField>
          <RField label="Product Price"><PriceInput value={draft.productPrice} onChange={(n) => update({ productPrice: n })} /></RField>
          <RField label="Product Validity"><Input value={draft.productValidity} onChange={(e) => update({ productValidity: e.target.value })} placeholder="e.g. 30 day" /></RField>
          <RField label="Live Date"><Input type="date" value={draft.liveDate} onChange={(e) => update({ liveDate: e.target.value })} /></RField>
          <RField label="Channel Open to">
            <OptionSelect value={draft.channelOpenTo} onChange={(v) => update({ channelOpenTo: v })} options={channels} />
          </RField>
          <RField label="Product Owner" className="sm:col-span-2">
            <Input value={draft.productOwner || ""} onChange={(e) => update({ productOwner: e.target.value })} />
          </RField>
        </div>

        <ResourceEditor
          resources={draft.resources}
          onUpdate={updateResource}
          onAdd={addResource}
          onRemove={removeResource}
        />

        <RField label="Reason / Description for approval">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this change is needed..."
            rows={3}
          />
        </RField>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Submit for Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----- Close Dialog -----
const CloseDialog: React.FC<{ item: CatalogItem; onConfirm: (reason: string) => void }> = ({ item, onConfirm }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs">
          <Lock className="h-3 w-3" /> Close
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Close</DialogTitle>
          <DialogDescription>
            Closing <span className="font-semibold">{item.productName}</span> marks it as closed but keeps it visible. Needs manager approval.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Description / reason for closing (required)..."
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!reason.trim()) return toast.error("Reason is required");
              onConfirm(reason);
              setOpen(false);
              setReason("");
            }}
          >
            Submit Close Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----- Delete Dialog -----
const DeleteDialog: React.FC<{ item: CatalogItem; onConfirm: (reason: string) => void }> = ({ item, onConfirm }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs text-destructive hover:text-destructive">
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Deletion</DialogTitle>
          <DialogDescription>
            Deleting <span className="font-semibold">{item.productName}</span> permanently removes it. Needs manager approval.
          </DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for deletion (required)..." rows={3} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!reason.trim()) return toast.error("Reason is required");
              onConfirm(reason);
              setOpen(false);
              setReason("");
            }}
          >
            Submit Delete Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----- Approvals List -----
const ApprovalsList: React.FC<{
  requests: ReturnType<typeof useCatalog>["requests"];
  items: CatalogItem[];
  isManager: boolean;
  onApprove: (id: string, comment: string) => void;
  onReject: (id: string, comment: string) => void;
}> = ({ requests, items, isManager, onApprove, onReject }) => {
  if (requests.length === 0) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">No catalog requests yet.</div>;
  }
  const typeColor: Record<string, string> = {
    add: "bg-emerald-100 text-emerald-700",
    modify: "bg-amber-100 text-amber-700",
    close: "bg-slate-200 text-slate-700",
    delete: "bg-red-100 text-red-700",
  };
  return (
    <div className="space-y-3">
      {requests.map((r) => {
        const target = r.itemId ? items.find((i) => i.id === r.itemId) : undefined;
        return (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeColor[r.type] || "bg-muted"}`}>
                    {r.type.toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    r.status === "pending" ? "bg-muted text-foreground" :
                    r.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                    "bg-red-100 text-red-700"
                  }`}>{r.status.toUpperCase()}</span>
                </div>
                <p className="text-sm font-semibold">
                  {r.draft?.productName || target?.productName || "(Item)"}
                  {r.type === "modify" && r.draft?.changesMade && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">— {r.draft.changesMade}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  by {r.requestedBy} • {new Date(r.requestedAt).toLocaleString()}
                </p>
                <p className="text-sm whitespace-pre-wrap mt-1">{r.reason}</p>
                {r.reviewComment && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Reviewed by {r.reviewedBy}: {r.reviewComment}
                  </p>
                )}
              </div>
              {isManager && r.status === "pending" && (
                <ApproveRejectButtons onApprove={(c) => onApprove(r.id, c)} onReject={(c) => onReject(r.id, c)} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ApproveRejectButtons: React.FC<{ onApprove: (c: string) => void; onReject: (c: string) => void }> = ({ onApprove, onReject }) => {
  const [comment, setComment] = useState("");
  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (required)..." rows={2} className="text-xs" />
      <div className="flex gap-2">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1" disabled={!comment.trim()} onClick={() => { onApprove(comment); setComment(""); }}>
          <CheckCircle2 className="h-3 w-3" /> Approve
        </Button>
        <Button size="sm" variant="destructive" className="gap-1" disabled={!comment.trim()} onClick={() => { onReject(comment); setComment(""); }}>
          <XCircle className="h-3 w-3" /> Reject
        </Button>
      </div>
    </div>
  );
};

export default CatalogPage;
