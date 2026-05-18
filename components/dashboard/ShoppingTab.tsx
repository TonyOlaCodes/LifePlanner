"use client";

import { useMemo, useState } from "react";
import { db, type FoodItem } from "@/lib/db";
import {
  applyRestockBatch,
  getParLevel,
  getStockStatus,
  isShoppingCandidate,
  previewQuantityAfterPurchase,
} from "@/lib/foodInventory";
import { formatFoodQuantity } from "@/lib/foodUnits";
import { vibrate } from "@/lib/utils";
import { Check, ShoppingCart, X } from "lucide-react";

type RestockLine = { foodItemId: string; packs: string; enabled: boolean };

function defaultLine(item: FoodItem): RestockLine {
  return {
    foodItemId: item.id,
    packs: "1",
    enabled: true,
  };
}

export default function ShoppingTab({ items }: { items: FoodItem[] }) {
  const list = items.filter(isShoppingCandidate);
  const [tripMode, setTripMode] = useState(false);
  const [restockLines, setRestockLines] = useState<RestockLine[]>([]);
  const [extraFoodId, setExtraFoodId] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const extrasAvailable = useMemo(
    () => items.filter((i) => !restockLines.some((l) => l.foodItemId === i.id)),
    [items, restockLines],
  );

  const enabledCount = restockLines.filter((l) => {
    if (!l.enabled) return false;
    const n = parseFloat(l.packs);
    return Number.isFinite(n) && n > 0;
  }).length;

  function startTrip() {
    vibrate(30);
    setMsg(null);
    setTripMode(true);
    setRestockLines(list.map(defaultLine));
    setExtraFoodId("");
  }

  function cancelTrip() {
    vibrate(15);
    setTripMode(false);
    setRestockLines([]);
    setMsg(null);
  }

  function updateLine(id: string, patch: Partial<RestockLine>) {
    setRestockLines((lines) => lines.map((l) => (l.foodItemId === id ? { ...l, ...patch } : l)));
  }

  function addExtraItem() {
    if (!extraFoodId || restockLines.some((l) => l.foodItemId === extraFoodId)) return;
    const item = items.find((i) => i.id === extraFoodId);
    if (!item) return;
    vibrate(20);
    setRestockLines((lines) => [...lines, defaultLine(item)]);
    setExtraFoodId("");
  }

  async function confirmTrip() {
    setMsg(null);
    const updates = restockLines
      .filter((l) => l.enabled)
      .map((l) => {
        const item = items.find((i) => i.id === l.foodItemId);
        const packs = parseFloat(l.packs);
        if (!item || !Number.isFinite(packs) || packs <= 0) return null;
        const amount = getParLevel(item) * packs;
        return { foodItemId: l.foodItemId, amount, unit: item.unit };
      })
      .filter(Boolean) as { foodItemId: string; amount: number; unit: string }[];

    if (!updates.length) {
      setMsg({ type: "err", text: "Turn on at least one item and enter how much you bought" });
      return;
    }

    const res = await applyRestockBatch(updates);
    if (!res.ok) {
      setMsg({ type: "err", text: res.errors.join(" · ") });
      vibrate([30, 50, 30]);
      return;
    }
    vibrate(50);
    setMsg({
      type: "ok",
      text: `Added ${updates.length} purchase${updates.length === 1 ? "" : "s"} to inventory`,
    });
    setTripMode(false);
    setRestockLines([]);
  }

  async function togglePin(item: FoodItem) {
    vibrate(20);
    await db.foodItems.update(item.id, {
      pinnedToShoppingList: !item.pinnedToShoppingList,
      updatedAt: Date.now(),
    });
  }

  function copyList() {
    const text = list
      .map((i) => `• ${i.emoji || ""} ${i.name} (full: ~${formatFoodQuantity(getParLevel(i), i.unit)})`)
      .join("\n");
    void navigator.clipboard?.writeText(text || "Shopping list empty");
    vibrate(30);
  }

  if (tripMode) {
    return (
      <div className="shopping-trip">
        <p className="shopping-hint">
          Enter how many <strong style={{ color: "var(--text-primary)", fontWeight: 700 }}>packs</strong> you bought.
          Each pack adds that food's saved full pack amount.
        </p>
        {msg && <p className={msg.type === "ok" ? "shopping-msg-ok" : "shopping-msg-err"}>{msg.text}</p>}
        <div className="shopping-list-scroll">
          {restockLines.length === 0 && (
            <p className="shopping-hint" style={{ marginBottom: 0 }}>
              Pick items below, then enter quantities.
            </p>
          )}
          {restockLines.map((line) => {
            const item = items.find((i) => i.id === line.foodItemId);
            if (!item) return null;
            const packs = parseFloat(line.packs);
            const bought = Number.isFinite(packs) && packs > 0 ? getParLevel(item) * packs : NaN;
            const after =
              Number.isFinite(bought) && bought > 0
                ? previewQuantityAfterPurchase(item, bought, item.unit)
                : null;

            return (
              <label
                key={line.foodItemId}
                className={`shopping-row tap-scale ${line.enabled ? "" : "shopping-row-off"}`}
              >
                <input
                  type="checkbox"
                  className="shopping-check"
                  checked={line.enabled}
                  onChange={(e) => updateLine(line.foodItemId, { enabled: e.target.checked })}
                />
                <span className="shopping-emoji">{item.emoji || "🛒"}</span>
                <div className="shopping-row-body">
                  <span className="shopping-name">{item.name}</span>
                  <span className="shopping-meta">
                    Have {formatFoodQuantity(item.quantity, item.unit)} · pack {formatFoodQuantity(getParLevel(item), item.unit)}
                    {after != null && line.enabled && (
                      <> · after → {formatFoodQuantity(after, item.unit)}</>
                    )}
                  </span>
                </div>
                <div className="shopping-qty-wrap">
                  <input
                    className="lock-input shopping-qty-input"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={line.packs}
                    onChange={(e) => updateLine(line.foodItemId, { packs: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="shopping-unit">packs</span>
                </div>
              </label>
            );
          })}
        </div>
        {items.length > 0 && (
          <div className="shopping-add-extra">
            <select
              className="lock-input"
              value={extraFoodId}
              onChange={(e) => setExtraFoodId(e.target.value)}
              style={{ flex: 1, minHeight: 48 }}
            >
              <option value="">+ Add another item…</option>
              {extrasAvailable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji} {f.name}
                </option>
              ))}
            </select>
            <button type="button" className="tap-scale shopping-add-btn" onClick={addExtraItem} disabled={!extraFoodId}>
              Add
            </button>
          </div>
        )}
        <div className="shopping-trip-footer">
          <button type="button" className="tap-scale shopping-btn-secondary" onClick={cancelTrip}>
            <X size={18} />
            Cancel
          </button>
          <button type="button" className="tap-scale shopping-btn-primary" onClick={() => void confirmTrip()}>
            <Check size={18} />
            Add{enabledCount > 0 ? ` ${enabledCount}` : ""} to inventory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shopping-home">
      <p className="shopping-hint">
        Low or out items show here. Go shopping to log what you bought — full amounts add to stock.
      </p>
      <button type="button" className="tap-scale shopping-btn-primary shopping-go-btn" onClick={startTrip}>
        <ShoppingCart size={18} />
        Go shopping
      </button>
      {msg && <p className="shopping-msg-ok">{msg.text}</p>}
      {list.length === 0 ? (
        <p className="shopping-empty">All stocked up. You can still go shopping to add purchases.</p>
      ) : (
        <>
          <button type="button" className="tap-scale shopping-btn-secondary" onClick={copyList}>
            Copy list
          </button>
          <div className="shopping-list-scroll shopping-list-home">
            {list.map((item) => {
              const status = getStockStatus(item);
              return (
                <div
                  key={item.id}
                  className="shopping-home-row"
                  style={{
                    borderColor: status === "out" ? "#EF444440" : status === "low" ? "#F59E0B40" : "var(--border)",
                  }}
                >
                  <span className="shopping-emoji">{item.emoji || "🛒"}</span>
                  <div className="shopping-row-body">
                    <span className="shopping-name">{item.name}</span>
                    <span className="shopping-meta">
                      {formatFoodQuantity(item.quantity, item.unit)} now · full pack ~{formatFoodQuantity(getParLevel(item), item.unit)}
                    </span>
                  </div>
                  <button type="button" className="tap-scale shopping-pin" onClick={() => void togglePin(item)}>
                    {item.pinnedToShoppingList ? "Pinned" : "Pin"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
