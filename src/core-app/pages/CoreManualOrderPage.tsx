import FieldNewSale from "@/field-app/pages/FieldNewSale";
import { corePath } from "@/core-app/lib/corePaths";

export default function CoreManualOrderPage() {
  console.log("Core Manual Order loaded");
  return <FieldNewSale exitRedirect={corePath("/orders")} allowCoreAdjustments />;
}