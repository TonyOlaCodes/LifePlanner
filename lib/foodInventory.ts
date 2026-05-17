import { db, type FoodItem, type MealIngredient, type MealTemplate } from "@/lib/db";
import { convertAmount, formatFoodQuantity, getUnitKind } from "@/lib/foodUnits";

export type StockStatus = "ok" | "low" | "out";

export function getStockStatus(item: FoodItem): StockStatus {
  if (item.quantity <= 0) return "out";
  if (item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold) return "low";
  return "ok";
}

export function getParLevel(item: FoodItem): number {
  if (item.parLevel != null && item.parLevel > 0) return item.parLevel;
  if (item.lowStockThreshold != null && item.lowStockThreshold > 0) return item.lowStockThreshold * 2;
  return Math.max(item.quantity, 1);
}

export function getStockProgress(item: FoodItem): number {
  const par = getParLevel(item);
  return Math.min(100, Math.max(0, (item.quantity / par) * 100));
}

export function shouldShowOutAlert(item: FoodItem): boolean {
  return item.outOfStockAlert !== false && item.quantity <= 0;
}

export function isShoppingCandidate(item: FoodItem): boolean {
  if (item.pinnedToShoppingList) return true;
  const status = getStockStatus(item);
  return status === "low" || status === "out";
}

/** How much to buy to reach par level (in the item's stored unit). */
export function getSuggestedRestock(item: FoodItem): number {
  const par = getParLevel(item);
  const need = par - item.quantity;
  if (need <= 0) return 0;
  const rounded = need >= 10 ? Math.round(need) : Math.round(need * 100) / 100;
  return rounded;
}

export async function applyRestockBatch(
  updates: { foodItemId: string; amount: number; unit: string }[],
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const now = Date.now();

  await db.transaction("rw", db.foodItems, async () => {
    for (const u of updates) {
      if (u.amount <= 0) continue;
      const item = await db.foodItems.get(u.foodItemId);
      if (!item) {
        errors.push("Item not found");
        continue;
      }
      const next = addToItem(item, u.amount, u.unit);
      if (next == null) {
        errors.push(`${item.name}: cannot add ${formatFoodQuantity(u.amount, u.unit)}`);
        continue;
      }
      await db.foodItems.update(item.id, {
        quantity: next,
        updatedAt: now,
        pinnedToShoppingList: false,
      });
    }
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

export function subtractFromItem(item: FoodItem, amount: number, unit: string): number | null {
  const converted = convertAmount(amount, unit, item.unit);
  if (converted == null) return null;
  return Math.max(0, item.quantity - converted);
}

export function addToItem(item: FoodItem, amount: number, unit: string): number | null {
  const converted = convertAmount(amount, unit, item.unit);
  if (converted == null) return null;
  return item.quantity + converted;
}

export async function applyIngredientDelta(
  foodItemId: string,
  amount: number,
  unit: string,
  direction: "add" | "subtract",
): Promise<{ ok: true; newQty: number } | { ok: false; reason: string }> {
  const item = await db.foodItems.get(foodItemId);
  if (!item) return { ok: false, reason: "Item not found" };
  const next =
    direction === "subtract" ? subtractFromItem(item, amount, unit) : addToItem(item, amount, unit);
  if (next == null) {
    return {
      ok: false,
      reason: `Cannot convert ${formatFoodQuantity(amount, unit)} to ${item.unit}`,
    };
  }
  await db.foodItems.update(item.id, { quantity: next, updatedAt: Date.now() });
  return { ok: true, newQty: next };
}

export async function logMealConsumption(
  mealName: string,
  ingredients: MealIngredient[],
  date: string,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const updates: { id: string; quantity: number }[] = [];

  for (const ing of ingredients) {
    const item = await db.foodItems.get(ing.foodItemId);
    if (!item) {
      errors.push(`Missing item for ingredient`);
      continue;
    }
    const next = subtractFromItem(item, ing.amount, ing.unit);
    if (next == null) {
      errors.push(
        `${item.name}: cannot use ${formatFoodQuantity(ing.amount, ing.unit)} (stored as ${formatFoodQuantity(item.quantity, item.unit)})`,
      );
      continue;
    }
    updates.push({ id: item.id, quantity: next });
  }

  if (errors.length) return { ok: false, errors };

  const now = Date.now();
  await db.transaction("rw", db.foodItems, db.mealLogs, async () => {
    for (const u of updates) {
      await db.foodItems.update(u.id, { quantity: u.quantity, updatedAt: now });
    }
    await db.mealLogs.put({
      id: crypto.randomUUID(),
      date,
      name: mealName,
      ingredients,
      createdAt: now,
    });
  });

  return { ok: true };
}

export function ingredientsFromTemplate(template: MealTemplate): MealIngredient[] {
  return template.ingredients.map((i) => ({ ...i }));
}
