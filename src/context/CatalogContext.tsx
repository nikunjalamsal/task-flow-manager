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

// Build a diff string between previous and new item: "Field: A → B"
const buildDiff = (prev: CatalogItem, next: CatalogItem): string => {
  const lines: string[] = [];
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
  for (const f of fields) {
    const a = (prev as any)[f.key] ?? "";
    const b = (next as any)[f.key] ?? "";
    if (String(a) !== String(b)) lines.push(`${f.label}: ${a || "(empty)"} → ${b || "(empty)"}`);
  }
  // Resources diff
  const prevR = JSON.stringify(prev.resources);
  const nextR = JSON.stringify(next.resources);
  if (prevR !== nextR) {
    const fmt = (rs: typeof prev.resources) =>
      rs.map((r) => `${r.subAccountName || r.subAccountId}=${r.resource}`).join(", ");
    lines.push(`Resources: ${fmt(prev.resources)} → ${fmt(next.resources)}`);
  }
  return lines.join("\n");
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString();
};

// Append a formatted entry to change detail audit trail
const appendDetail = (existing: string | undefined, entry: string): string => {
  const prev = (existing || "").trim();
  return prev ? `${prev}\n${entry}` : entry;
};

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [requests, setRequests] = useState<CatalogRequest[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Initial load from server (with localStorage fallback)
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

  // Persist on change (after initial load)
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
            const detailEntry = `${fmtDate(nowIso)} — ADDED: Requested by ${r.requestedBy}, Approved by ${reviewerName}${comment ? ` — ${comment}` : ""}`;
            const log = [
              ...r.draft.changeLog,
              {
                id: generateId(),
                date: nowIso,
                requestedBy: r.requestedBy,
                changeMadeBy: reviewerName,
                description: comment || "Item added.",
                summary: "Added",
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
                changeDetail: detailEntry,
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
              const diff = buildDiff(it, merged) || (r.draft!.changesMade || r.reason);
              notifyChangesMade = diff;
              const detailEntry = `${fmtDate(nowIso)} — MODIFIED: Requested by ${r.requestedBy}, Approved by ${reviewerName}\n${diff}${comment ? `\nNote: ${comment}` : ""}`;
              return {
                ...merged,
                changesDate: today,
                changesMade: diff,
                changeMadeBy: r.requestedBy,
                changeDetail: appendDetail(it.changeDetail, detailEntry),
                changeLog: [
                  ...it.changeLog,
                  {
                    id: generateId(),
                    date: nowIso,
                    requestedBy: r.requestedBy,
                    changeMadeBy: reviewerName,
                    description: comment || r.reason,
                    summary: diff,
                  },
                ],
              };
            });
          }

          if (r.type === "close" && r.itemId) {
            return prevItems.map((it) => {
              if (it.id !== r.itemId) return it;
              const detailEntry = `${fmtDate(nowIso)} — CLOSED: Requested by ${r.requestedBy}, Approved by ${reviewerName}\nReason: ${r.reason}${comment ? `\nNote: ${comment}` : ""}`;
              return {
                ...it,
                status: "closed",
                closeDate: today,
                closeReason: r.reason,
                changesDate: today,
                changesMade: "Closed",
                changeMadeBy: r.requestedBy,
                changeDetail: appendDetail(it.changeDetail, detailEntry),
                changeLog: [
                  ...it.changeLog,
                  {
                    id: generateId(),
                    date: nowIso,
                    requestedBy: r.requestedBy,
                    changeMadeBy: reviewerName,
                    description: comment || r.reason,
                    summary: "Closed",
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
