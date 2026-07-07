import FieldNewSale from "@/field-app/pages/FieldNewSale";
import { corePath } from "@/core-app/lib/corePaths";

export default function CoreManualOrderPage() {
  return <FieldNewSale exitRedirect={corePath("/orders")} allowCoreAdjustments />;
}