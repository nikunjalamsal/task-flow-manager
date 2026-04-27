import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CatalogItem, CatalogRequest, CatalogRequestType } from "@/lib/catalogTypes";
import { generateId } from "@/lib/utils";
import { notifyApi, catalogApi } from "@/lib/taskApi";

const CATALOG_KEY = "cal_catalog";
const CATALOG_REQ_KEY = "cal_catalog_requests";

interface CatalogContextType {
  items: CatalogItem[];
  requests: CatalogRequest[];
  loaded: boolean;
  submitRequest: (req: {
    type: CatalogRequestType;
    itemId?: string;
    draft?: CatalogItem;
    reason: string;
    requestedBy: string;
    requestedById: string;
  }) => { success: boolean; message: string };
  approveRequest: (id: string, reviewerName: string, comment: string) => void;
  rejectRequest: (id: string, reviewerName: string, comment: string) => void;
}

const CatalogContext = createContext<CatalogContextType | null>(null);

const seedItems = (): CatalogItem[] => [
  {
    id: generateId(),
    sn: 1,
    productName: "A",
    productType: "Onetime",
    productId: "1111",
    productCode: "S123",
    productPrice: 100,
    resources: [
      { subAccountId: "124", subAccountName: "Data", resource: "104857600" },
      { subAccountId: "234", subAccountName: "Voice", resource: "100" },
      { subAccountId: "6433", subAccountName: "SMS", resource: "10" },
      { subAccountId: "6323", subAccountName: "Unlimited", resource: "2067846292" },
    ],
    productValidity: "1 day",
    liveDate: "2026-04-22",
    channelOpenTo: "All",
    productOwner: "BSS_Team",
    changesDate: "",
    changesMade: "",
    changeMadeBy: "",
    changeDetail: "",
    changeLog: [],
    createdAt: new Date().toISOString(),
    status: "live",
  },
];

// Build structured field-level diffs for the changeLog entry.
const buildFieldChanges = (
  prev: CatalogItem,
  next: CatalogItem
): Array<{ label: string; from: string; to: string }> => {
  const fields: { key: keyof CatalogItem; label: string }[] = [
    { key: "productName", label: "Name" },
    { key: "productType", label: "Type" },
    { key: "productId", label: "Product ID" },
    { key: "productCode", label: "Code" },
    { key: "productPrice", label: "Price" },
    { key: "productValidity", label: "Validity" },
    { key: "liveDate", label: "Live Date" },
    { key: "channelOpenTo", label: "Channel" },
    { key: "productOwner", label: "Product Owner" },
  ];
  const out: Array<{ label: string; from: string; to: string }> = [];
  for (const f of fields) {
    const a = (prev as any)[f.key] ?? "";
    const b = (next as any)[f.key] ?? "";
    if (String(a) !== String(b)) out.push({ label: f.label, from: String(a || ""), to: String(b || "") });
  }
  return out;
};

// Build structured resource-level diffs (per sub-account).
const buildResourceChanges = (
  prev: CatalogItem,
  next: CatalogItem
): Array<{ label: string; from: string; to: string }> => {
  const keyOf = (r: { subAccountId: string; subAccountName: string }) =>
    r.subAccountName || r.subAccountId || "";
  const prevMap = new Map(prev.resources.map((r) => [keyOf(r), r.resource]));
  const nextMap = new Map(next.resources.map((r) => [keyOf(r), r.resource]));
  const allKeys = Array.from(new Set([...prevMap.keys(), ...nextMap.keys()]));
  const out: Array<{ label: string; from: string; to: string }> = [];
  for (const k of allKeys) {
    const a = prevMap.get(k) ?? "";
    const b = nextMap.get(k) ?? "";
    if (a !== b) out.push({ label: k || "(resource)", from: a, to: b });
  }
  return out;
};

// Compact one-line summary for display in tables/notifications.
const buildSummary = (
  fieldChanges: Array<{ label: string; from: string; to: string }>,
  resourceChanges: Array<{ label: string; from: string; to: string }>
): string => {
  const parts = [
    ...fieldChanges.map((c) => `${c.label}: ${c.from || "(empty)"} → ${c.to || "(empty)"}`),
    ...resourceChanges.map((c) => `${c.label}: ${c.from || "(empty)"} → ${c.to || "(empty)"}`),
  ];
  return parts.join("; ");
};

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [requests, setRequests] = useState<CatalogRequest[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [serverItems, serverReqs] = await Promise.all([
        catalogApi.loadItems(),
        catalogApi.loadRequests(),
      ]);
      if (serverItems.length === 0) {
        const seed = seedItems();
        setItems(seed);
        catalogApi.saveItems(seed);
      } else {
        setItems(serverItems);
      }
      setRequests(serverReqs);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
    catalogApi.saveItems(items);
  }, [items, loaded]);
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(CATALOG_REQ_KEY, JSON.stringify(requests));
    catalogApi.saveRequests(requests);
  }, [requests, loaded]);

  const submitRequest: CatalogContextType["submitRequest"] = useCallback((req) => {
    if (!req.reason.trim()) return { success: false, message: "Reason is required." };
    if ((req.type === "modify" || req.type === "delete" || req.type === "close") && !req.itemId) {
      return { success: false, message: "Target item is required." };
    }
    if ((req.type === "add" || req.type === "modify") && !req.draft) {
      return { success: false, message: "Draft data is required." };
    }
    const newReq: CatalogRequest = {
      id: generateId(),
      type: req.type,
      status: "pending",
      requestedBy: req.requestedBy,
      requestedById: req.requestedById,
      requestedAt: new Date().toISOString(),
      reason: req.reason,
      itemId: req.itemId,
      draft: req.draft,
    };
    setRequests((prev) => [newReq, ...prev]);
    const productName = req.draft?.productName || "(item)";
    notifyApi.notifyCatalogEvent({
      phase: "submitted",
      requestType: req.type,
      productName,
      requestedBy: req.requestedBy,
      reason: req.reason,
      changesMade: req.draft?.changesMade,
    });
    return { success: true, message: "Request submitted for manager approval." };
  }, []);

  const approveRequest = useCallback(
    (id: string, reviewerName: string, comment: string) => {
      let notifyName = "(item)";
      let notifyType: CatalogRequestType = "modify";
      let notifyRequestedBy = "";
      let notifyChangesMade: string | undefined;
      let notifyReason = "";

      setRequests((prevReqs) => {
        const r = prevReqs.find((x) => x.id === id);
        if (!r) return prevReqs;

        notifyType = r.type;
        notifyRequestedBy = r.requestedBy;
        notifyReason = r.reason;

        setItems((prevItems) => {
          const today = new Date().toISOString().slice(0, 10);
          const nowIso = new Date().toISOString();
          const existing = r.itemId ? prevItems.find((i) => i.id === r.itemId) : undefined;
          notifyName = r.draft?.productName || existing?.productName || "(item)";

          if (r.type === "add" && r.draft) {
            const nextSn = (prevItems.reduce((m, i) => Math.max(m, i.sn), 0) || 0) + 1;
            const log = [
              ...r.draft.changeLog,
              {
                id: generateId(),
                date: nowIso,
                requestedBy: r.requestedBy,
                changeMadeBy: reviewerName,
                description: comment || "Item added.",
                summary: "Added",
                action: "added" as const,
              },
            ];
            return [
              ...prevItems,
              {
                ...r.draft,
                id: generateId(),
                sn: nextSn,
                status: "live",
                changeMadeBy: r.requestedBy,
                changeDetail: "",
                changeLog: log,
              },
            ];
          }

          if (r.type === "modify" && r.draft && r.itemId) {
            return prevItems.map((it) => {
              if (it.id !== r.itemId) return it;
              const merged: CatalogItem = {
                ...r.draft!,
                id: it.id,
                sn: it.sn,
                status: it.status || "live",
                closeDate: it.closeDate,
                closeReason: it.closeReason,
                createdAt: it.createdAt,
              };
              const fieldChanges = buildFieldChanges(it, merged);
              const resourceChanges = buildResourceChanges(it, merged);
              const summary = buildSummary(fieldChanges, resourceChanges) || (r.draft!.changesMade || r.reason);
              notifyChangesMade = summary;
              return {
                ...merged,
                changesDate: today,
                changesMade: summary,
                changeMadeBy: r.requestedBy,
                changeDetail: "",
                changeLog: [
                  ...it.changeLog,
                  {
                    id: generateId(),
                    date: nowIso,
                    requestedBy: r.requestedBy,
                    changeMadeBy: reviewerName,
                    description: comment || r.reason,
                    summary,
                    action: "modified" as const,
                    fieldChanges,
                    resourceChanges,
                  },
                ],
              };
            });
          }

          if (r.type === "close" && r.itemId) {
            return prevItems.map((it) => {
              if (it.id !== r.itemId) return it;
              return {
                ...it,
                status: "closed",
                closeDate: today,
                closeReason: r.reason,
                changesDate: today,
                changesMade: "Closed",
                changeMadeBy: r.requestedBy,
                changeDetail: "",
                changeLog: [
                  ...it.changeLog,
                  {
                    id: generateId(),
                    date: nowIso,
                    requestedBy: r.requestedBy,
                    changeMadeBy: reviewerName,
                    description: comment || r.reason,
                    summary: "Closed",
                    action: "closed" as const,
                  },
                ],
              };
            });
          }

          if (r.type === "delete" && r.itemId) {
            return prevItems.filter((it) => it.id !== r.itemId);
          }
          return prevItems;
        });

        return prevReqs.map((x) =>
          x.id === id
            ? { ...x, status: "approved", reviewedBy: reviewerName, reviewedAt: new Date().toISOString(), reviewComment: comment }
            : x
        );
      });

      notifyApi.notifyCatalogEvent({
        phase: "approved",
        requestType: notifyType,
        productName: notifyName,
        requestedBy: notifyRequestedBy,
        reviewedBy: reviewerName,
        reason: notifyReason,
        comment,
        changesMade: notifyChangesMade,
      });
    },
    []
  );

  const rejectRequest = useCallback((id: string, reviewerName: string, comment: string) => {
    let notifyName = "(item)";
    let notifyType: CatalogRequestType = "modify";
    let notifyRequestedBy = "";
    let notifyReason = "";

    setRequests((prev) => {
      const r = prev.find((x) => x.id === id);
      if (r) {
        notifyType = r.type;
        notifyRequestedBy = r.requestedBy;
        notifyReason = r.reason;
        notifyName = r.draft?.productName || "(item)";
      }
      return prev.map((x) =>
        x.id === id
          ? { ...x, status: "rejected", reviewedBy: reviewerName, reviewedAt: new Date().toISOString(), reviewComment: comment }
          : x
      );
    });

    notifyApi.notifyCatalogEvent({
      phase: "rejected",
      requestType: notifyType,
      productName: notifyName,
      requestedBy: notifyRequestedBy,
      reviewedBy: reviewerName,
      reason: notifyReason,
      comment,
    });
  }, []);

  return (
    <CatalogContext.Provider value={{ items, requests, loaded, submitRequest, approveRequest, rejectRequest }}>
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
};
