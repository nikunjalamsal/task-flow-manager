import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCatalog } from "@/context/CatalogContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, ArrowLeft, Plus, Pencil, Trash2, LogOut, Shield, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { CatalogItem, CatalogResource, CatalogRequestType } from "@/lib/catalogTypes";
import { generateId } from "@/lib/utils";
import { toast } from "sonner";

const emptyItem = (): CatalogItem => ({
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
  closeDate: "",
  changesDate: "",
  changesMade: "",
  changeMadeBy: "",
  changeDetail: "",
  changeLog: [],
  createdAt: new Date().toISOString(),
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

            <ItemDialog
              mode="add"
              triggerButton={
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Request Add
                </Button>
              }
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

          <TabsContent value="catalog" className="mt-6">
            <CatalogTable
              items={items}
              onModify={(item) => {
                if (!user) return null as any;
                return (draft: CatalogItem, reason: string) => {
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
                };
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
  onModify: (item: CatalogItem) => ((draft: CatalogItem, reason: string) => void) | null;
  onDelete: (item: CatalogItem, reason: string) => void;
}> = ({ items, onModify, onDelete }) => {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No catalog items yet. Submit an add request.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-muted/50 text-left">
          <tr>
            <Th>SN</Th>
            <Th>Product Name</Th>
            <Th>Product Type</Th>
            <Th>Product ID</Th>
            <Th>Product Code</Th>
            <Th>Product Price</Th>
            <Th>Product Resources</Th>
            <Th>Product Validity</Th>
            <Th>Live Date</Th>
            <Th>Channel Open to</Th>
            <Th>Close Date</Th>
            <Th>Changes Date</Th>
            <Th>Changes Made</Th>
            <Th>Change Made By</Th>
            <Th>Change Detail</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-border align-top hover:bg-muted/20">
              <Td>{it.sn}</Td>
              <Td>{it.productName}</Td>
              <Td>{it.productType}</Td>
              <Td>{it.productId}</Td>
              <Td>{it.productCode}</Td>
              <Td>{it.productPrice}</Td>
              <Td>
                <table className="text-xs border border-border">
                  <tbody>
                    <tr>
                      <td className="border border-border px-1 font-medium">Sub account id</td>
                      {it.resources.map((r, i) => (
                        <td key={i} className="border border-border px-1">{r.subAccountId}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="border border-border px-1 font-medium">Subaccount name</td>
                      {it.resources.map((r, i) => (
                        <td key={i} className="border border-border px-1">{r.subAccountName}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="border border-border px-1 font-medium">Resource</td>
                      {it.resources.map((r, i) => (
                        <td key={i} className="border border-border px-1">{r.resource}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </Td>
              <Td>{it.productValidity}</Td>
              <Td>{it.liveDate}</Td>
              <Td>{it.channelOpenTo}</Td>
              <Td>{it.closeDate || "-"}</Td>
              <Td>{it.changesDate || "-"}</Td>
              <Td>{it.changesMade || "-"}</Td>
              <Td>{it.changeMadeBy || "-"}</Td>
              <Td>
                <div className="whitespace-pre-wrap text-xs">{it.changeDetail || "-"}</div>
                {it.changeLog.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-primary">History ({it.changeLog.length})</summary>
                    <ul className="mt-1 space-y-1">
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
                <div className="flex flex-col gap-1">
                  <ItemDialog
                    mode="modify"
                    initial={it}
                    triggerButton={
                      <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs">
                        <Pencil className="h-3 w-3" /> Modify
                      </Button>
                    }
                    onSubmit={(draft, reason) => {
                      const cb = onModify(it);
                      if (cb) cb(draft, reason);
                    }}
                  />
                  <DeleteDialog item={it} onConfirm={(reason) => onDelete(it, reason)} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="px-2 py-2 text-xs font-semibold text-foreground border-b border-border whitespace-nowrap">{children}</th>
);
const Td: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <td className="px-2 py-2 text-xs text-foreground">{children}</td>
);

// ----- Item Dialog (Add/Modify request) -----
const ItemDialog: React.FC<{
  mode: "add" | "modify";
  initial?: CatalogItem;
  triggerButton: React.ReactNode;
  onSubmit: (draft: CatalogItem, reason: string) => void;
}> = ({ mode, initial, triggerButton, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogItem>(() => initial || emptyItem());
  const [reason, setReason] = useState("");

  const update = (patch: Partial<CatalogItem>) => setDraft((d) => ({ ...d, ...patch }));
  const updateResource = (idx: number, patch: Partial<CatalogResource>) =>
    setDraft((d) => ({
      ...d,
      resources: d.resources.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  const addResource = () =>
    setDraft((d) => ({ ...d, resources: [...d.resources, { subAccountId: "", subAccountName: "", resource: "" }] }));
  const removeResource = (idx: number) =>
    setDraft((d) => ({ ...d, resources: d.resources.filter((_, i) => i !== idx) }));

  const handleSubmit = () => {
    if (!draft.productName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required for approval");
      return;
    }
    onSubmit(draft, reason);
    setOpen(false);
    setReason("");
    if (mode === "add") setDraft(emptyItem());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Request New Catalog Item" : "Request Modification"}</DialogTitle>
          <DialogDescription>Submit for manager approval.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Product Name"><Input value={draft.productName} onChange={(e) => update({ productName: e.target.value })} /></Field>
          <Field label="Product Type"><Input value={draft.productType} onChange={(e) => update({ productType: e.target.value })} placeholder="Onetime / Renewal / ..." /></Field>
          <Field label="Product ID"><Input value={draft.productId} onChange={(e) => update({ productId: e.target.value })} /></Field>
          <Field label="Product Code"><Input value={draft.productCode} onChange={(e) => update({ productCode: e.target.value })} /></Field>
          <Field label="Product Price"><Input type="number" value={draft.productPrice} onChange={(e) => update({ productPrice: Number(e.target.value) })} /></Field>
          <Field label="Product Validity"><Input value={draft.productValidity} onChange={(e) => update({ productValidity: e.target.value })} placeholder="e.g. 30 day" /></Field>
          <Field label="Live Date"><Input type="date" value={draft.liveDate} onChange={(e) => update({ liveDate: e.target.value })} /></Field>
          <Field label="Channel Open to"><Input value={draft.channelOpenTo} onChange={(e) => update({ channelOpenTo: e.target.value })} placeholder="All / USSD / App" /></Field>
          <Field label="Close Date"><Input type="date" value={draft.closeDate || ""} onChange={(e) => update({ closeDate: e.target.value })} /></Field>
          <Field label="Changes Date"><Input type="date" value={draft.changesDate || ""} onChange={(e) => update({ changesDate: e.target.value })} /></Field>
          <Field label="Changes Made" className="sm:col-span-2"><Input value={draft.changesMade || ""} onChange={(e) => update({ changesMade: e.target.value })} /></Field>
          <Field label="Change Made By"><Input value={draft.changeMadeBy || ""} onChange={(e) => update({ changeMadeBy: e.target.value })} /></Field>
          <Field label="Change Detail" className="sm:col-span-2"><Textarea value={draft.changeDetail || ""} onChange={(e) => update({ changeDetail: e.target.value })} rows={3} /></Field>
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
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this change is needed..." rows={3} />
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

// ----- Delete Dialog -----
const DeleteDialog: React.FC<{ item: CatalogItem; onConfirm: (reason: string) => void }> = ({ item, onConfirm }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7 px-2 text-xs text-destructive">
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Deletion</DialogTitle>
          <DialogDescription>Deleting "{item.productName}" needs manager approval.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for deletion (required)..." rows={3} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!reason.trim()) {
                toast.error("Reason is required");
                return;
              }
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
  return (
    <div className="space-y-3">
      {requests.map((r) => {
        const target = r.itemId ? items.find((i) => i.id === r.itemId) : undefined;
        return (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    r.type === "add" ? "bg-emerald-100 text-emerald-700" :
                    r.type === "modify" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>{r.type.toUpperCase()}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    r.status === "pending" ? "bg-muted text-foreground" :
                    r.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                    "bg-red-100 text-red-700"
                  }`}>{r.status.toUpperCase()}</span>
                </div>
                <p className="text-sm font-semibold">
                  {r.draft?.productName || target?.productName || "(Item)"}
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
