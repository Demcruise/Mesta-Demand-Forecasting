import type { Metadata } from "next";
import { ProductsView } from "@/features/demand-data/products-view";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return <ProductsView />;
}
