import type { Location, Product } from "@/types/domain";
import { createRng } from "./random";
import { DAY_MS, isoDate, startOfToday } from "./time";

/**
 * Fictional retail catalogue. Names, brands and hierarchy are placeholders until the
 * real product hierarchy is confirmed (backlog §93 item 3).
 */

type SubcategoryDef = { name: string; items: string[]; sizes: string[]; unit: string };
type CategoryDef = {
  name: string;
  subcategories: SubcategoryDef[];
  /** Relative daily volume multiplier. */
  volume: number;
  /** Annual seasonality amplitude. */
  seasonality: number;
};

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    name: "Beverages",
    volume: 1.6,
    seasonality: 0.14,
    subcategories: [
      { name: "Bottled water", items: ["Mineral Water", "Sparkling Water", "Alkaline Water"], sizes: ["330 ml", "600 ml", "1.5 L"], unit: "bottles" },
      { name: "Soft drinks", items: ["Cola", "Lemon Soda", "Orange Soda", "Ginger Ale"], sizes: ["330 ml can", "1 L", "1.5 L"], unit: "units" },
      { name: "Ready-to-drink tea", items: ["Jasmine Tea", "Green Tea", "Lychee Tea", "Lemon Tea"], sizes: ["350 ml", "500 ml"], unit: "bottles" },
      { name: "Juice", items: ["Orange Juice", "Guava Juice", "Mango Nectar", "Apple Juice"], sizes: ["250 ml", "1 L"], unit: "cartons" },
    ],
  },
  {
    name: "Dairy & Chilled",
    volume: 1.1,
    seasonality: 0.06,
    subcategories: [
      { name: "Milk", items: ["UHT Full Cream Milk", "UHT Low Fat Milk", "Chocolate Milk", "Strawberry Milk"], sizes: ["200 ml", "1 L"], unit: "cartons" },
      { name: "Yoghurt", items: ["Plain Yoghurt", "Strawberry Yoghurt", "Drinking Yoghurt"], sizes: ["100 g", "500 g", "250 ml"], unit: "cups" },
      { name: "Cheese", items: ["Cheddar Slices", "Processed Cheese Block", "Mozzarella"], sizes: ["170 g", "250 g"], unit: "packs" },
    ],
  },
  {
    name: "Snacks",
    volume: 1.2,
    seasonality: 0.1,
    subcategories: [
      { name: "Chips", items: ["Cassava Chips", "Potato Chips Original", "Seaweed Chips", "Corn Chips"], sizes: ["68 g", "150 g"], unit: "packs" },
      { name: "Biscuits", items: ["Butter Cookies", "Cream Crackers", "Chocolate Wafers", "Coconut Biscuits"], sizes: ["130 g", "300 g", "Tin 650 g"], unit: "packs" },
      { name: "Confectionery", items: ["Milk Chocolate Bar", "Mint Candy", "Fruit Jelly", "Caramel Toffee"], sizes: ["40 g", "100 g"], unit: "units" },
    ],
  },
  {
    name: "Staples",
    volume: 1.3,
    seasonality: 0.12,
    subcategories: [
      { name: "Rice", items: ["Premium Rice", "Fragrant Rice", "Brown Rice"], sizes: ["2 kg", "5 kg", "10 kg"], unit: "bags" },
      { name: "Cooking oil", items: ["Palm Cooking Oil", "Coconut Oil", "Sunflower Oil"], sizes: ["1 L", "2 L"], unit: "pouches" },
      { name: "Instant noodles", items: ["Fried Noodles", "Chicken Soup Noodles", "Curry Noodles", "Spicy Noodles"], sizes: ["85 g", "5-pack"], unit: "packs" },
      { name: "Sugar & flour", items: ["Granulated Sugar", "Wheat Flour", "Tapioca Flour"], sizes: ["1 kg", "500 g"], unit: "packs" },
    ],
  },
  {
    name: "Personal Care",
    volume: 0.7,
    seasonality: 0.05,
    subcategories: [
      { name: "Hair care", items: ["Anti-Dandruff Shampoo", "Herbal Shampoo", "Conditioner"], sizes: ["170 ml", "340 ml"], unit: "bottles" },
      { name: "Bath & soap", items: ["Bar Soap", "Body Wash", "Hand Wash"], sizes: ["110 g", "450 ml"], unit: "units" },
      { name: "Oral care", items: ["Toothpaste", "Toothbrush Soft", "Mouthwash"], sizes: ["120 g", "2-pack", "250 ml"], unit: "units" },
    ],
  },
  {
    name: "Household",
    volume: 0.8,
    seasonality: 0.04,
    subcategories: [
      { name: "Laundry", items: ["Powder Detergent", "Liquid Detergent", "Fabric Softener"], sizes: ["800 g", "1.6 L", "Refill 750 ml"], unit: "units" },
      { name: "Dishwashing", items: ["Dishwashing Liquid Lime", "Dishwashing Liquid Orange"], sizes: ["400 ml", "780 ml"], unit: "pouches" },
      { name: "Tissue & paper", items: ["Facial Tissue", "Toilet Roll", "Kitchen Towel"], sizes: ["250 sheets", "10 rolls", "2 rolls"], unit: "packs" },
    ],
  },
  {
    name: "Baby & Kids",
    volume: 0.5,
    seasonality: 0.03,
    subcategories: [
      { name: "Diapers", items: ["Tape Diapers", "Pants Diapers"], sizes: ["S 40", "M 34", "L 30", "XL 26"], unit: "packs" },
      { name: "Baby food", items: ["Rice Porridge", "Formula Stage 1", "Formula Stage 2"], sizes: ["120 g", "400 g", "800 g"], unit: "units" },
    ],
  },
  {
    name: "Frozen",
    volume: 0.6,
    seasonality: 0.18,
    subcategories: [
      { name: "Frozen meals", items: ["Chicken Nuggets", "Beef Meatballs", "Fish Dumplings", "Spring Rolls"], sizes: ["250 g", "500 g"], unit: "packs" },
      { name: "Ice cream", items: ["Vanilla Tub", "Chocolate Cone", "Durian Stick", "Matcha Cup"], sizes: ["60 ml", "700 ml"], unit: "units" },
    ],
  },
];

export const CATEGORIES = CATEGORY_DEFS.map((c) => c.name);

const BRANDS = [
  "Nusa",
  "Tirta Jaya",
  "Sumber Rasa",
  "Lestari",
  "Mekar",
  "Bening",
  "Karya",
  "Segar",
  "Harmoni",
  "Pelangi",
  "Sejuk",
  "Arunika",
  "Mesta Select",
];

export const REGIONS = [
  "Jabodetabek",
  "West Java",
  "Central Java",
  "East Java",
  "Bali & Nusa Tenggara",
  "North Sumatra",
  "Sulawesi",
];

export const STORE_GROUPS = ["Hypermarket", "Supermarket", "Convenience"] as const;

export const BUSINESS_UNITS = ["Grocery Retail", "Convenience Retail"] as const;

export function categoryDef(name: string) {
  return CATEGORY_DEFS.find((c) => c.name === name);
}

export function generateProducts(count: number, seed: number): Product[] {
  const rng = createRng(seed);
  const today = startOfToday();
  const products: Product[] = [];
  const used = new Set<string>();
  let i = 0;
  while (products.length < count && i < count * 6) {
    i++;
    const cat = rng.pick(CATEGORY_DEFS);
    const sub = rng.pick(cat.subcategories);
    const item = rng.pick(sub.items);
    const size = rng.pick(sub.sizes);
    const brand = rng.pick(BRANDS);
    const name = `${brand} ${item} ${size}`;
    if (used.has(name)) continue;
    used.add(name);
    const n = products.length + 1;
    const catCode = cat.name.replace(/[^A-Z]/g, "").slice(0, 2).padEnd(2, "X");
    const lifecycleRoll = rng.next();
    const lifecycle: Product["lifecycle"] =
      lifecycleRoll < 0.06 ? "new" : lifecycleRoll < 0.14 ? "seasonal" : lifecycleRoll < 0.18 ? "end-of-life" : "core";
    const launchedDaysAgo = lifecycle === "new" ? rng.int(20, 70) : rng.int(200, 2400);
    products.push({
      id: `prd_${n.toString().padStart(5, "0")}`,
      sku: `SKU-${catCode}${(10000 + n * 7).toString()}`,
      name,
      category: cat.name,
      subcategory: sub.name,
      brand,
      unit: sub.unit,
      lifecycle,
      launchedAt: isoDate(today - launchedDaysAgo * DAY_MS),
    });
  }
  return products;
}

export function generateLocations(count: number, seed: number): Location[] {
  const rng = createRng(seed);
  const out: Location[] = [];
  for (let n = 1; n <= count; n++) {
    const region = REGIONS[(n - 1) % REGIONS.length] as string;
    const group = rng.pick(STORE_GROUPS);
    out.push({
      id: `loc_${n.toString().padStart(3, "0")}`,
      name: `${region.split(" ")[0]} ${group} ${String(n).padStart(2, "0")}`,
      region,
      storeGroup: group,
    });
  }
  return out;
}
