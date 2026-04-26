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
} from "lucide-react";
import { CatalogItem, CatalogResource } from "@/lib/catalogTypes";
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
        it.changeDetail,
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
      {/* Filters */}
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
                <Th>Close Date</Th>
                <Th>Changes Date</Th>
                <Th>Changes Made</Th>
                <Th>Change By</Th>
                <Th>Change Detail</Th>
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
                    <Td>
                      <span className="font-semibold">{it.sn}</span>
                    </Td>
                    <Td>
                      {isClosed ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30">
                          <Lock className="h-3 w-3 mr-1" /> Closed
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                          ● Live
                        </Badge>
                      )}
                    </Td>
                    <Td><span className="font-medium text-foreground">{it.productName}</span></Td>
                    <Td>
                      <Badge variant="outline" className="font-normal">{it.productType}</Badge>
                    </Td>
                    <Td className="font-mono text-[11px]">{it.productId}</Td>
                    <Td className="font-mono text-[11px]">{it.productCode}</Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {it.productPrice}
                    </Td>
                    <Td>
                      <table className="text-[11px] border border-border rounded overflow-hidden">
                        <tbody>
                          <tr className="bg-muted/40">
                            <td className="border border-border px-1.5 py-0.5 font-medium">Sub a/c id</td>
                            {it.resources.map((r, i) => (
                              <td key={i} className="border border-border px-1.5 py-0.5">{r.subAccountId}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="border border-border px-1.5 py-0.5 font-medium">Name</td>
                            {it.resources.map((r, i) => (
                              <td key={i} className="border border-border px-1.5 py-0.5">{r.subAccountName}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="border border-border px-1.5 py-0.5 font-medium">Resource</td>
                            {it.resources.map((r, i) => (
                              <td key={i} className="border border-border px-1.5 py-0.5">{r.resource}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </Td>
                    <Td>{it.productValidity}</Td>
                    <Td className="whitespace-nowrap">{it.liveDate}</Td>
                    <Td><Badge variant="secondary" className="font-normal">{it.channelOpenTo}</Badge></Td>
                    <Td className="whitespace-nowrap">{it.closeDate || "—"}</Td>
                    <Td className="whitespace-nowrap">{it.changesDate || "—"}</Td>
                    <Td>{it.changesMade || "—"}</Td>
                    <Td>{it.changeMadeBy || "—"}</Td>
                    <Td>
                      <div className="whitespace-pre-wrap text-[11px] max-w-[260px]">{it.changeDetail || "—"}</div>
                      {it.changeLog.length > 0 && (
                        <details className="mt-2 text-[11px]">
                          <summary className="cursor-pointer text-primary inline-flex items-center gap-1">
                            <History className="h-3 w-3" /> History ({it.changeLog.length})
                          </summary>
                          <ul className="mt-1 space-y-1 max-w-[260px]">
                            {it.changeLog.map((l) => (
                              <li key={l.id} className="border-l-2 border-primary pl-2">
                                <div className="font-medium">{new Date(l.date).toLocaleString()}</div>
                                <div>Requested: {l.requestedBy}</div>
                                <div>By: {l.changeMadeBy}</div>
                                <div className="whitespace-pre-wrap">{l.description}</div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1 min-w-[110px]">
                        {!isClosed && (
                          <ModifyDialog
                            item={it}
                            onSubmit={(draft, reason) => onModify(it, draft, reason)}
                          />
                        )}
                        {!isClosed && (
                          <CloseDialog item={it} onConfirm={(reason) => onClose(it, reason)} />
                        )}
                        <DeleteDialog item={it} onConfirm={(reason) => onDelete(it, reason)} />
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

// ----- Add Dialog (full form, no change/close fields) -----
const AddDialog: React.FC<{ onSubmit: (draft: CatalogItem, reason: string) => void }> = ({ onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogItem>(() => emptyItem());
  const [reason, setReason] = useState("");

  const update = (patch: Partial<CatalogItem>) => setDraft((d) => ({ ...d, ...patch }));
  const updateResource = (idx: number, patch: Partial<CatalogResource>) =>
    setDraft((d) => ({ ...d, resources: d.resources.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  const addResource = () =>
    setDraft((d) => ({ ...d, resources: [...d.resources, { subAccountId: "", subAccountName: "", resource: "" }] }));
  const removeResource = (idx: number) =>
    setDraft((d) => ({ ...d, resources: d.resources.filter((_, i) => i !== idx) }));

  const handleSubmit = () => {
    if (!draft.productName.trim()) return toast.error("Product name is required");
    if (!reason.trim()) return toast.error("Reason is required for approval");
    onSubmit(draft, reason);
    setOpen(false);
    setReason("");
    setDraft(emptyItem());
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
          <DialogDescription>Fill in the product details. Submitted for manager approval.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Product Name"><Input value={draft.productName} onChange={(e) => update({ productName: e.target.value })} /></Field>
          <Field label="Product Type">
            <Select value={draft.productType} onValueChange={(v) => update({ productType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Onetime">Onetime</SelectItem>
                <SelectItem value="Renewal">Renewal</SelectItem>
                <SelectItem value="Saapati">Saapati</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Product ID"><Input value={draft.productId} onChange={(e) => update({ productId: e.target.value })} /></Field>
          <Field label="Product Code"><Input value={draft.productCode} onChange={(e) => update({ productCode: e.target.value })} /></Field>
          <Field label="Product Price"><Input type="number" value={draft.productPrice} onChange={(e) => update({ productPrice: Number(e.target.value) })} /></Field>
          <Field label="Product Validity"><Input value={draft.productValidity} onChange={(e) => update({ productValidity: e.target.value })} placeholder="e.g. 30 day" /></Field>
          <Field label="Live Date"><Input type="date" value={draft.liveDate} onChange={(e) => update({ liveDate: e.target.value })} /></Field>
          <Field label="Channel Open to">
            <Select value={draft.channelOpenTo} onValueChange={(v) => update({ channelOpenTo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="USSD">USSD</SelectItem>
                <SelectItem value="App">App</SelectItem>
                <SelectItem value="Web">Web</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Product Resources</Label>
            <Button size="sm" variant="outline" onClick={addResource} className="gap-1 h-7 px-2"><Plus className="h-3 w-3" /> Add</Button>
          </div>
          <div className="space-y-2">
            {draft.resources.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3"><Label className="text-xs">Sub account id</Label><Input value={r.subAccountId} onChange={(e) => updateResource(i, { subAccountId: e.target.value })} /></div>
                <div className="col-span-4"><Label className="text-xs">Subaccount name</Label><Input value={r.subAccountName} onChange={(e) => updateResource(i, { subAccountName: e.target.value })} /></div>
                <div className="col-span-4"><Label className="text-xs">Resource</Label><Input value={r.resource} onChange={(e) => updateResource(i, { resource: e.target.value })} /></div>
                <div className="col-span-1"><Button size="sm" variant="ghost" onClick={() => removeResource(i)}><Trash2 className="h-3 w-3" /></Button></div>
              </div>
            ))}
          </div>
        </div>

        <Field label="Reason / Description for approval (required)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this product needs to be added..." rows={3} />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Submit for Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----- Modify Dialog (full edit of all fields) -----
const ModifyDialog: React.FC<{
  item: CatalogItem;
  onSubmit: (draft: CatalogItem, reason: string) => void;
}> = ({ item, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogItem>(item);
  const [changesMade, setChangesMade] = useState("");
  const [reason, setReason] = useState("");

  // Reset form whenever the dialog is opened with a fresh copy of the item
  React.useEffect(() => {
    if (open) {
      setDraft({ ...item, resources: item.resources.map((r) => ({ ...r })) });
      setChangesMade("");
      setReason("");
    }
  }, [open, item]);

  const update = (patch: Partial<CatalogItem>) => setDraft((d) => ({ ...d, ...patch }));
  const updateResource = (idx: number, patch: Partial<CatalogResource>) =>
    setDraft((d) => ({ ...d, resources: d.resources.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  const addResource = () =>
    setDraft((d) => ({ ...d, resources: [...d.resources, { subAccountId: "", subAccountName: "", resource: "" }] }));
  const removeResource = (idx: number) =>
    setDraft((d) => ({ ...d, resources: d.resources.filter((_, i) => i !== idx) }));

  const handleSubmit = () => {
    if (!changesMade.trim())
      return toast.error("Please summarise what is being changed (Changes Made).");
    if (!reason.trim()) return toast.error("Reason is required for approval");
    onSubmit({ ...draft, changesMade }, reason);
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
            Editing <span className="font-semibold">{item.productName}</span>. Update any field.
            Change date and reviewer are filled in automatically when approved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Product Name"><Input value={draft.productName} onChange={(e) => update({ productName: e.target.value })} /></Field>
          <Field label="Product Type">
            <Select value={draft.productType} onValueChange={(v) => update({ productType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Onetime">Onetime</SelectItem>
                <SelectItem value="Renewal">Renewal</SelectItem>
                <SelectItem value="Saapati">Saapati</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Product ID"><Input value={draft.productId} onChange={(e) => update({ productId: e.target.value })} /></Field>
          <Field label="Product Code"><Input value={draft.productCode} onChange={(e) => update({ productCode: e.target.value })} /></Field>
          <Field label="Product Price"><Input type="number" value={draft.productPrice} onChange={(e) => update({ productPrice: Number(e.target.value) })} /></Field>
          <Field label="Product Validity"><Input value={draft.productValidity} onChange={(e) => update({ productValidity: e.target.value })} placeholder="e.g. 30 day" /></Field>
          <Field label="Live Date"><Input type="date" value={draft.liveDate} onChange={(e) => update({ liveDate: e.target.value })} /></Field>
          <Field label="Channel Open to">
            <Select value={draft.channelOpenTo} onValueChange={(v) => update({ channelOpenTo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="USSD">USSD</SelectItem>
                <SelectItem value="App">App</SelectItem>
                <SelectItem value="Web">Web</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Product Resources</Label>
            <Button size="sm" variant="outline" onClick={addResource} className="gap-1 h-7 px-2"><Plus className="h-3 w-3" /> Add</Button>
          </div>
          <div className="space-y-2">
            {draft.resources.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3"><Label className="text-xs">Sub account id</Label><Input value={r.subAccountId} onChange={(e) => updateResource(i, { subAccountId: e.target.value })} /></div>
                <div className="col-span-4"><Label className="text-xs">Subaccount name</Label><Input value={r.subAccountName} onChange={(e) => updateResource(i, { subAccountName: e.target.value })} /></div>
                <div className="col-span-4"><Label className="text-xs">Resource</Label><Input value={r.resource} onChange={(e) => updateResource(i, { resource: e.target.value })} /></div>
                <div className="col-span-1"><Button size="sm" variant="ghost" onClick={() => removeResource(i)}><Trash2 className="h-3 w-3" /></Button></div>
              </div>
            ))}
          </div>
        </div>

        <Field label="Changes Made — short summary (required)">
          <Input
            value={changesMade}
            onChange={(e) => setChangesMade(e.target.value)}
            placeholder="e.g. Changed voice from 50 to 100, updated price"
          />
        </Field>
        <Field label="Reason / Description for approval (required)">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this change is needed..."
            rows={3}
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Submit for Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={`space-y-1 ${className || ""}`}>
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

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
