import * as XLSX from "xlsx";
import { CatalogItem } from "./catalogTypes";

export const exportCatalogToExcel = (items: CatalogItem[]) => {
  const rows = items.map((it) => ({
    "SN": it.sn,
    "Status": (it.status || "live").toUpperCase(),
    "Product Name": it.productName,
    "Product Type": it.productType,
    "Product ID": it.productId,
    "Product Code": it.productCode,
    "Product Price": it.productPrice,
    "Resources": it.resources
      .map((r) => `${r.subAccountName} (id:${r.subAccountId}) = ${r.resource}`)
      .join("\n"),
    "Validity": it.productValidity,
    "Live Date": it.liveDate,
    "Channel Open To": it.channelOpenTo,
    "Product Owner": it.productOwner || "",
    "Close Date": it.closeDate || "",
    "Close Reason": it.closeReason || "",
    "Changes Date": it.changesDate || "",
    "Changes Made": it.changesMade || "",
    "Change Made By": it.changeMadeBy || "",
    "Change Detail": it.changeDetail || "",
    "Change History": it.changeLog
      .map(
        (l) =>
          `[${new Date(l.date).toLocaleString()}] requested by ${l.requestedBy}, by ${l.changeMadeBy}: ${l.summary} — ${l.description}`
      )
      .join("\n"),
    "Created At": it.createdAt,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 30 },
    { wch: 18 }, { wch: 40 }, { wch: 60 }, { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Catalog");
  XLSX.writeFile(wb, `Product_Catalog_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
