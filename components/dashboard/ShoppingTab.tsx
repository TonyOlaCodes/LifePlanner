"use client";

import { useState } from "react";
import { db, type FoodItem } from "@/lib/db";
import {
  applyRestockBatch,
  getParLevel,
  getStockStatus,
  getSuggestedRestock,
  isShoppingCandidate,
} from "@/lib/foodInventory";
import { formatFoodQuantity } from "@/lib/foodUnits";
import { vibrate } from "@/lib/utils";
import { Check, ShoppingCart } from "lucide-react";

type RestockLine = { foodItemId: string; amount: string; enabled: boolean };

const primaryBtn: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "var(--accent)",
  border: "none",
  color: "#000",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

const secondaryBtn: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

export default function ShoppingTab({ items }: { items: FoodItem[] }) {
  const list = items.filter(isShoppingCandidate);
  const [tripMode, setTripMode] = useState(false);
  const [restockLines, setRestockLines] = useState<RestockLine[]>([]);
  const [extraFoodId, setExtraFoodId] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function startTrip() {
    vibrate(30);
    setMsg(null);
    setTripMode(true);
    setRestockLines(
      list.map((item) => ({
        foodItemId: item.id,
        amount: String(getSuggestedRestock(item) || getParLevel(item)),
        enabled: true,
      })),
    );
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
    setRestockLines((lines) => [
      ...lines,
      { foodItemId: item.id, amount: String(getSuggestedRestock(item) || 1), enabled: true },
    ]);
    setExtraFoodId("");
  }

  async function confirmTrip() {
    setMsg(null);
    const updates = restockLines
      .filter((l) => l.enabled)
      .map((l) => {
        const item = items.find((i) => i.id === l.foodItemId);
        const amount = parseFloat(l.amount);
        if (!item || !Number.isFinite(amount) || amount <= 0) return null;
        return { foodItemId: l.foodItemId, amount, unit: item.unit };
      })
      .filter(Boolean) as { foodItemId: string; amount: number; unit: string }[];

    if (!updates.length) {
      setMsg({ type: "err", text: "Select at least one item with a quantity" });
      return;
    }

    const res = await applyRestockBatch(updates);
    if (!res.ok) {
      setMsg({ type: "err", text: res.errors.join(" · ") });
      vibrate([30, 50, 30]);
      return;
    }
    vibrate(50);
    setMsg({ type: "ok", text: `Added ${updates.length} item${updates.length === 1 ? "" : "s"} to inventory` });
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
      .map((i) => {
        const need =
          i.lowStockThreshold != null && i.quantity < i.lowStockThreshold
            ? ` (have ${formatFoodQuantity(i.quantity, i.unit)}, want ~${formatFoodQuantity(getParLevel(i), i.unit)})`
            : "";
        return `• ${i.name}${need}`;
      })
      .join("\n");
    void navigator.clipboard?.writeText(text || "Shopping list empty");
    vibrate(30);
  }

  const extrasAvailable = items.filter((i) => !restockLines.some((l) => l.foodItemId === i.id));

  if (tripMode) {
    return (
      <div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 12px" }}>
          Enter what you bought. Confirm to add everything to inventory at once.
        </p>
        {msg && (
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: msg.type === "ok" ? "var(--accent)" : "#F87171",
              marginBottom: 12,
            }}
          >
            {msg.text}
          </p>
        )}
        {restockLines.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            No items on your list yet — add what you bought below.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
          {restockLines.map((line) => {
            const item = items.find((i) => i.id === line.foodItemId);
            if (!item) return null;
            return (
              <div
                key={line.foodItemId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                  borderRadius: 12,
                  background: line.enabled ? "var(--surface-2)" : "var(--surface-3)",
                  border: "1px solid var(--border)",
                  opacity: line.enabled ? 1 : 0.55,
                }}
              >
                <input
                  type="checkbox"
                  checked={line.enabled}
                  onChange={(e) => updateLine(line.foodItemId, { enabled: e.target.checked })}
                  style={{ accentColor: "var(--accent)", width: 18, height: 18, flexShrink: 0 }}
                />
                <span style={{ fontSize: 20 }}>{item.emoji || "🛒"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    Have {formatFoodQuantity(item.quantity, item.unit)}
                  </div>
                </div>
                <input
                  className="lock-input"
                  type="number"
                  min={0}
                  step="any"
                  value={line.amount}
                  onChange={(e) => updateLine(line.foodItemId, { amount: e.target.value })}
                  style={{ width: 72, padding: "8px 10px", fontSize: 13 }}
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, flexShrink: 0 }}>
                  {item.unit}
                </span>
              </div>
            );
          })}
        </div>
        {items.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select className="lock-input" value={extraFoodId} onChange={(e) => setExtraFoodId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Add another item…</option>
              {extrasAvailable.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji} {f.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="tap-scale"
              onClick={addExtraItem}
              disabled={!extraFoodId}
              style={{ ...primaryBtn, width: "auto", padding: "0 16px", opacity: extraFoodId ? 1 : 0.5 }}
            >
              Add
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="tap-scale" onClick={cancelTrip} style={{ ...secondaryBtn, flex: 1 }}>
            Cancel
          </button>
          <button
            type="button"
            className="tap-scale"
            onClick={() => void confirmTrip()}
            style={{ ...primaryBtn, flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Check size={16} />
            Confirm restock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 14px" }}>
        Items appear here when stock is low, out, or pinned. Restock suggestions use your par level.
      </p>
      <button
        type="button"
        className="tap-scale"
        onClick={startTrip}
        style={{ ...primaryBtn, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <ShoppingCart size={16} />
        Go shopping
      </button>
      {msg && (
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 12 }}>{msg.text}</p>
      )}
      {list.length === 0 ? (
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            padding: 16,
            borderRadius: 14,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          All stocked up — nothing on the list. Tap Go shopping to restock anything you bought.
        </p>
      ) : (
        <>
          <button type="button" className="tap-scale" onClick={copyList} style={{ ...secondaryBtn, marginBottom: 12 }}>
            Copy shopping list
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
            {list.map((item) => {
              const status = getStockStatus(item);
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    background: "var(--surface-2)",
                    border: `1px solid ${status === "out" ? "#EF444440" : "#F59E0B40"}`,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{item.emoji || "🛒"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Have {formatFoodQuantity(item.quantity, item.unit)} · target ~{formatFoodQuantity(getParLevel(item), item.unit)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void togglePin(item)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: item.pinnedToShoppingList ? "var(--accent)20" : "var(--surface-3)",
                      color: item.pinnedToShoppingList ? "var(--accent)" : "var(--text-tertiary)",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
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
