export type ProductType = "Onetime" | "Renewal" | "Saapati" | string;
export type ChannelOpenTo = "All" | "USSD" | "App" | "Web" | string;

export interface CatalogResource {
  subAccountId: string;
  subAccountName: string;
  resource: string;
}

export interface CatalogChangeLog {
  id: string;
  date: string; // ISO
  requestedBy: string;
  changeMadeBy: string;
  description: string;
  summary: string; // e.g. "Changed voice from 50 to 100"
}

export interface CatalogItem {
  id: string;
  sn: number;
  productName: string;
  productType: ProductType;
  productId: string;
  productCode: string;
  productPrice: number;
  resources: CatalogResource[];
  productValidity: string;
  liveDate: string;
  channelOpenTo: ChannelOpenTo;
  closeDate?: string;
  changesDate?: string;
  changesMade?: string;
  changeMadeBy?: string;
  changeDetail?: string;
  changeLog: CatalogChangeLog[];
  createdAt: string;
  status?: CatalogStatus;
  closeReason?: string;
}

export type CatalogStatus = "live" | "closed";
export type CatalogRequestType = "add" | "modify" | "delete" | "close";
export type CatalogRequestStatus = "pending" | "approved" | "rejected";

export interface CatalogRequest {
  id: string;
  type: CatalogRequestType;
  status: CatalogRequestStatus;
  requestedBy: string;
  requestedById: string;
  requestedAt: string;
  reason: string;
  // for add/modify: full target item; for delete/modify: existing itemId
  itemId?: string;
  draft?: CatalogItem;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
}
