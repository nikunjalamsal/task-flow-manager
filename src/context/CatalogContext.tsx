import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CatalogItem, CatalogRequest, CatalogRequestType } from "@/lib/catalogTypes";
import { generateId } from "@/lib/utils";

const CATALOG_KEY = "cal_catalog";
const CATALOG_REQ_KEY = "cal_catalog_requests";

interface CatalogContextType {
  items: CatalogItem[];
  requests: CatalogRequest[];
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

const loadItems = (): CatalogItem[] => {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? JSON.parse(raw) : seedItems();
  } catch {
    return seedItems();
  }
};
const loadReqs = (): CatalogRequest[] => {
  try {
    const raw = localStorage.getItem(CATALOG_REQ_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const seedItems = (): CatalogItem[] => {
  const seed: CatalogItem[] = [
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
      changesDate: "2026-04-23",
      changesMade: "Changed voice from 50 to 100",
      changeMadeBy: "BSS_Team",
      changeDetail: "Requested: nlamsal\nChange made by: BSS_team\nDescription: Approval of XXXX",
      changeLog: [],
      createdAt: new Date().toISOString(),
      status: "live",
    },
  ];
  localStorage.setItem(CATALOG_KEY, JSON.stringify(seed));
  return seed;
};

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CatalogItem[]>(() => loadItems());
  const [requests, setRequests] = useState<CatalogRequest[]>(() => loadReqs());

  useEffect(() => {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    localStorage.setItem(CATALOG_REQ_KEY, JSON.stringify(requests));
  }, [requests]);

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
    return { success: true, message: "Request submitted for manager approval." };
  }, []);

  const approveRequest = useCallback(
    (id: string, reviewerName: string, comment: string) => {
      setRequests((prevReqs) => {
        const r = prevReqs.find((x) => x.id === id);
        if (!r) return prevReqs;

        setItems((prevItems) => {
          const today = new Date().toISOString().slice(0, 10);
          if (r.type === "add" && r.draft) {
            const nextSn = (prevItems.reduce((m, i) => Math.max(m, i.sn), 0) || 0) + 1;
            const log = [
              ...r.draft.changeLog,
              {
                id: generateId(),
                date: new Date().toISOString(),
                requestedBy: r.requestedBy,
                changeMadeBy: reviewerName,
                description: comment || "Item added.",
                summary: "Added",
              },
            ];
            return [...prevItems, { ...r.draft, id: generateId(), sn: nextSn, status: "live", changeLog: log }];
          }
          if (r.type === "modify" && r.draft && r.itemId) {
            return prevItems.map((it) =>
              it.id === r.itemId
                ? {
                    ...r.draft!,
                    id: it.id,
                    sn: it.sn,
                    status: it.status || "live",
                    closeDate: it.closeDate,
                    closeReason: it.closeReason,
                    changesDate: today,
                    changesMade: r.draft!.changesMade || r.reason,
                    changeMadeBy: reviewerName,
                    changeDetail: `Requested: ${r.requestedBy}\nChange made by: ${reviewerName}\nDescription: ${comment || r.reason}`,
                    changeLog: [
                      ...it.changeLog,
                      {
                        id: generateId(),
                        date: new Date().toISOString(),
                        requestedBy: r.requestedBy,
                        changeMadeBy: reviewerName,
                        description: comment || "Modified.",
                        summary: r.draft!.changesMade || r.reason,
                      },
                    ],
                  }
                : it
            );
          }
          if (r.type === "close" && r.itemId) {
            return prevItems.map((it) =>
              it.id === r.itemId
                ? {
                    ...it,
                    status: "closed",
                    closeDate: today,
                    closeReason: r.reason,
                    changesDate: today,
                    changesMade: "Closed",
                    changeMadeBy: reviewerName,
                    changeDetail: `Requested: ${r.requestedBy}\nClosed by: ${reviewerName}\nDescription: ${comment || r.reason}`,
                    changeLog: [
                      ...it.changeLog,
                      {
                        id: generateId(),
                        date: new Date().toISOString(),
                        requestedBy: r.requestedBy,
                        changeMadeBy: reviewerName,
                        description: comment || r.reason,
                        summary: "Closed",
                      },
                    ],
                  }
                : it
            );
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
    },
    []
  );

  const rejectRequest = useCallback((id: string, reviewerName: string, comment: string) => {
    setRequests((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "rejected", reviewedBy: reviewerName, reviewedAt: new Date().toISOString(), reviewComment: comment }
          : x
      )
    );
  }, []);

  return (
    <CatalogContext.Provider value={{ items, requests, submitRequest, approveRequest, rejectRequest }}>
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
};
