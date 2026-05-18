"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { db, getTodayString, type FoodItem, type MealIngredient, type MealTemplate } from "@/lib/db";
import {
  applyIngredientDelta,
  getParLevel,
  getStockProgress,
  getStockStatus,
  ingredientsFromTemplate,
  isShoppingCandidate,
  logMealConsumption,
  shouldShowOutAlert,
} from "@/lib/foodInventory";
import {
  defaultQuickDelta,
  defaultUnitForKind,
  formatFoodQuantity,
  getUnitKind,
  UNIT_KIND_OPTIONS,
  unitsForKind,
  type UnitKind,
} from "@/lib/foodUnits";
import { vibrate } from "@/lib/utils";
import BottomSheet from "@/components/ui/BottomSheet";
import ShoppingTab from "@/components/dashboard/ShoppingTab";
import {
  Minus,
  Plus,
  ShoppingCart,
  UtensilsCrossed,
  Package,
  AlertTriangle,
  Pencil,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";

type SheetTab = "inventory" | "meals" | "shopping";

const FOOD_EMOJIS = [
  "🥛", "🧀", "🧈", "🫕",
  "🍗", "🥩", "🐟", "🦐", "🥚", "🍖", "🥓", "🌭", "🍔", "🥪",
  "🍞", "🥖", "🥐", "🥯", "🧇", "🥞", "🍚", "🍝", "🥣", "🌾", "🌮", "🌯",
  "🍎", "🍌", "🍊", "🍇", "🍓", "🫐", "🍋", "🥑", "🍅", "🥒", "🥕", "🥦", "🥬", "🧅", "🥔", "🌽", "🍠",
  "🥫", "🧃", "☕", "🍵", "🫒", "🧂", "🍯", "🥜", "🍫", "🍪", "🧁", "🍩",
  "🥗", "🍕", "🍜", "🍲", "🥡", "🍱", "🥘", "🍣", "🥟", "🍤",
  "🧊", "🍦", "🥤", "🍶",
];

export default function FoodInventorySection() {
  const today = getTodayString();
  const items = useLiveQuery(() => db.foodItems.orderBy("name").toArray(), []);
  const templates = useLiveQuery(() => db.mealTemplates.orderBy("name").toArray(), []);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<SheetTab>("inventory");

  const lowCount = useMemo(() => (items || []).filter((i) => getStockStatus(i) === "low").length, [items]);
  const outCount = useMemo(
    () => (items || []).filter((i) => shouldShowOutAlert(i) || getStockStatus(i) === "out").length,
    [items],
  );
  const shoppingItems = useMemo(() => (items || []).filter(isShoppingCandidate), [items]);
  const sortedItems = useMemo(
    () => [...(items || [])].sort((a, b) => stockRatio(a) - stockRatio(b) || a.name.localeCompare(b.name)),
    [items],
  );

  function openSheet(nextTab: SheetTab = "inventory") {
    vibrate(30);
    setTab(nextTab);
    setSheetOpen(true);
  }

  return (
    <>
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Food Inventory</h2>
          <button
            type="button"
            className="tap-scale"
            onClick={() => openSheet("inventory")}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Manage
          </button>
        </div>

        {(lowCount > 0 || outCount > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 14,
              marginBottom: 12,
              background: outCount > 0 ? "#EF444418" : "#F59E0B18",
              border: `1px solid ${outCount > 0 ? "#EF444440" : "#F59E0B40"}`,
            }}
          >
            <AlertTriangle size={16} style={{ color: outCount > 0 ? "#EF4444" : "#F59E0B", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: outCount > 0 ? "#FCA5A5" : "#FCD34D" }}>
              {outCount > 0 && `${outCount} out of stock`}
              {outCount > 0 && lowCount > 0 && " · "}
              {lowCount > 0 && `${lowCount} running low`}
            </span>
          </div>
        )}

        {(!items || items.length === 0) ? (
          <div
            style={{
              padding: 20,
              borderRadius: 18,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>🥗</div>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-secondary)" }}>
              Track what is in your pantry and log meals to auto-deduct stock.
            </p>
            <button
              type="button"
              className="tap-scale"
              onClick={() => openSheet("inventory")}
              style={{
                padding: "12px 20px",
                borderRadius: 14,
                background: "var(--accent)",
                border: "none",
                color: "#000",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Add your first item
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            {sortedItems.slice(0, 12).map((item) => (
              <FoodCompactCard key={item.id} item={item} onOpen={() => openSheet("inventory")} />
            ))}
            {items.length > 12 && (
              <button
                type="button"
                onClick={() => openSheet("inventory")}
                style={{
                  minHeight: 92,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px dashed var(--border)",
                  background: "transparent",
                  color: "var(--text-tertiary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                +{items.length - 12} more
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <QuickActionBtn icon={<Package size={16} />} label="Inventory" onClick={() => openSheet("inventory")} />
          <QuickActionBtn icon={<UtensilsCrossed size={16} />} label="Log meal" onClick={() => openSheet("meals")} />
          <QuickActionBtn
            icon={<ShoppingCart size={16} />}
            label={`Shop${shoppingItems.length ? ` (${shoppingItems.length})` : ""}`}
            onClick={() => openSheet("shopping")}
          />
        </div>
      </section>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Food Inventory">
        <SheetTabs tab={tab} setTab={setTab} />
        {tab === "inventory" && <InventoryTab items={items || []} />}
        {tab === "meals" && (
          <MealsTab items={items || []} templates={templates || []} today={today} />
        )}
        {tab === "shopping" && <ShoppingTab items={items || []} />}
      </BottomSheet>
    </>
  );
}

function SheetTabs({ tab, setTab }: { tab: SheetTab; setTab: (t: SheetTab) => void }) {
  const tabs: { key: SheetTab; label: string }[] = [
    { key: "inventory", label: "Stock" },
    { key: "meals", label: "Meals" },
    { key: "shopping", label: "Shop" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setTab(t.key)}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 12,
            border: `1px solid ${tab === t.key ? "var(--accent)" : "var(--border)"}`,
            background: tab === t.key ? "var(--accent)" : "var(--surface-3)",
            color: tab === t.key ? "#000" : "var(--text-secondary)",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function QuickActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tap-scale"
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "10px 8px",
        borderRadius: 14,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      {label}
    </button>
  );
}

function FoodItemRow({
  item,
  compact,
  onOpen,
  onEdit,
  editActive,
}: {
  item: FoodItem;
  compact?: boolean;
  onOpen?: () => void;
  onEdit?: () => void;
  editActive?: boolean;
}) {
  const status = getStockStatus(item);
  const progress = getStockProgress(item);
  const barColor = stockColor(item);

  async function quick(delta: "add" | "subtract") {
    vibrate(30);
    const kind = getUnitKind(item.unit);
    const amt =
      delta === "add"
        ? item.quickAddAmount ?? (kind ? defaultQuickDelta(kind, item.unit) : 1)
        : item.quickConsumeAmount ?? (kind ? defaultQuickDelta(kind, item.unit) : 1);
    await applyIngredientDelta(item.id, amt, item.unit, delta === "add" ? "add" : "subtract");
  }

  return (
    <div
      style={{
        padding: compact ? "12px 14px" : "14px 16px",
        borderRadius: 16,
        background: "var(--surface-2)",
        border: `1px solid ${status === "out" ? "#EF444440" : status === "low" ? "#F59E0B40" : "var(--border)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: compact ? 22 : 26 }}>{item.emoji || "🥫"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{item.name}</span>
            {status === "low" && (
              <span style={{ fontSize: 9, fontWeight: 800, color: "#F59E0B", textTransform: "uppercase" }}>Low</span>
            )}
            {status === "out" && (
              <span style={{ fontSize: 9, fontWeight: 800, color: "#EF4444", textTransform: "uppercase" }}>Out</span>
            )}
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
            {formatFoodQuantity(item.quantity, item.unit)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {onEdit && (
            <IconBtn onClick={onEdit} label="Edit item" active={editActive}>
              <Pencil size={14} />
            </IconBtn>
          )}
          <IconBtn onClick={() => void quick("subtract")} label="Consume">
            <Minus size={14} />
          </IconBtn>
          <IconBtn onClick={() => void quick("add")} label="Add">
            <Plus size={14} />
          </IconBtn>
        </div>
      </div>
      <div style={{ marginTop: 10, height: 6, borderRadius: 100, background: "var(--surface-3)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            borderRadius: 100,
            background: barColor,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      {!compact && onOpen && (
        <button
          type="button"
          onClick={onOpen}
          style={{
            marginTop: 8,
            padding: 0,
            border: "none",
            background: "none",
            color: "var(--text-tertiary)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Edit in inventory →
        </button>
      )}
    </div>
  );
}

function stockRatio(item: FoodItem): number {
  const par = getParLevel(item);
  return par > 0 ? item.quantity / par : 0;
}

function stockColor(item: FoodItem): string {
  const ratio = stockRatio(item);
  if (ratio >= 1) return "#22C55E";
  if (ratio >= 0.65) return "#84CC16";
  if (ratio >= 0.35) return "#F59E0B";
  return "#EF4444";
}

function FoodCompactCard({ item, onOpen }: { item: FoodItem; onOpen: () => void }) {
  const progress = getStockProgress(item);
  const color = stockColor(item);
  const status = getStockStatus(item);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap-scale"
      style={{
        minHeight: 92,
        padding: "10px 8px",
        borderRadius: 12,
        background: `${color}12`,
        border: `1px solid ${color}40`,
        color: "var(--text-primary)",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji || "🥫"}</span>
        <span style={{ fontSize: 11, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
      </div>
      <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {formatFoodQuantity(item.quantity, item.unit)}
      </span>
      <div style={{ marginTop: "auto", height: 6, borderRadius: 100, background: "var(--surface-3)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: color, borderRadius: 100 }} />
      </div>
      <span style={{ fontSize: 9, color, fontWeight: 900, textTransform: "uppercase" }}>
        {status === "out" ? "Out" : status === "low" ? "Low" : stockRatio(item) >= 1 ? "Full" : `${Math.round(progress)}%`}
      </span>
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="tap-scale"
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent)25" : "var(--surface-3)",
        color: active ? "var(--accent)" : "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function InventoryTab({ items }: { items: FoodItem[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <AddFoodForm onSaved={() => setEditingId(null)} />
      {items.length > 0 && (
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.6, margin: "20px 0 10px" }}>
          In stock ({items.length})
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
        {[...items].sort((a, b) => stockRatio(a) - stockRatio(b) || a.name.localeCompare(b.name)).map((item) => (
          <div key={item.id}>
            <FoodItemRow
              item={item}
              editActive={editingId === item.id}
              onEdit={() => {
                vibrate(20);
                setEditingId(editingId === item.id ? null : item.id);
              }}
            />
            {editingId === item.id && (
              <EditFoodForm item={item} onDone={() => setEditingId(null)} onDelete={() => setEditingId(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddFoodForm({ onSaved }: { onSaved?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🥫");
  const [qty, setQty] = useState("");
  const [unitKind, setUnitKind] = useState<UnitKind>("weight");
  const [unit, setUnit] = useState("g");
  const [low, setLow] = useState("");
  const [par, setPar] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    const quantity = parseFloat(qty);
    if (!name.trim()) {
      setErr("Enter a food name");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      setErr("Enter a valid quantity");
      return;
    }
    const now = Date.now();
    await db.foodItems.put({
      id: crypto.randomUUID(),
      name: name.trim(),
      emoji,
      quantity,
      unit,
      lowStockThreshold: low ? parseFloat(low) : undefined,
      parLevel: par ? parseFloat(par) : undefined,
      outOfStockAlert: true,
      createdAt: now,
      updatedAt: now,
    });
    vibrate(40);
    setName("");
    setQty("");
    setLow("");
    setPar("");
    setExpanded(false);
    onSaved?.();
  }

  return (
    <div style={{ padding: 14, borderRadius: 16, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <button
        type="button"
        className="tap-scale"
        onClick={() => {
          vibrate(15);
          setExpanded((x) => !x);
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: 0,
          border: "none",
          background: "transparent",
          color: "var(--text-primary)",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} style={{ color: "var(--accent)" }} />
          Add new food
        </span>
        {expanded ? <ChevronUp size={18} color="var(--text-tertiary)" /> : <ChevronDown size={18} color="var(--text-tertiary)" />}
      </button>
      {expanded && (
        <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12, marginBottom: 10, maxHeight: 120, overflowY: "auto" }}>
        {FOOD_EMOJIS.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => setEmoji(e)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1px solid ${emoji === e ? "var(--accent)" : "var(--border)"}`,
              background: emoji === e ? "var(--accent)25" : "var(--surface-3)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <input className="lock-input" placeholder="Name (e.g. Milk)" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input className="lock-input" type="number" min={0} step="any" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} style={{ flex: 1 }} />
        <select
          className="lock-input"
          value={unitKind}
          onChange={(e) => {
            const k = e.target.value as UnitKind;
            setUnitKind(k);
            setUnit(defaultUnitForKind(k));
          }}
          style={{ flex: 1 }}
        >
          {UNIT_KIND_OPTIONS.map((o) => (
            <option key={o.kind} value={o.kind}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="lock-input" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ flex: 1 }}>
          {unitsForKind(unitKind).map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input className="lock-input" type="number" min={0} step="any" placeholder="Low stock at" value={low} onChange={(e) => setLow(e.target.value)} style={{ flex: 1 }} />
        <input className="lock-input" type="number" min={0} step="any" placeholder="Full stock (par)" value={par} onChange={(e) => setPar(e.target.value)} style={{ flex: 1 }} />
      </div>
      {err && <p style={{ color: "#EF4444", fontSize: 12, margin: "0 0 8px" }}>{err}</p>}
      <button type="button" className="tap-scale" onClick={() => void save()} style={primaryBtn}>
        Add to inventory
      </button>
        </>
      )}
    </div>
  );
}

function EditFoodForm({
  item,
  onDone,
  onDelete,
}: {
  item: FoodItem;
  onDone: () => void;
  onDelete: () => void;
}) {
  const [qty, setQty] = useState(String(item.quantity));
  const [low, setLow] = useState(item.lowStockThreshold != null ? String(item.lowStockThreshold) : "");
  const [par, setPar] = useState(item.parLevel != null ? String(item.parLevel) : "");
  const [quickAdd, setQuickAdd] = useState(item.quickAddAmount != null ? String(item.quickAddAmount) : "");
  const [quickUse, setQuickUse] = useState(item.quickConsumeAmount != null ? String(item.quickConsumeAmount) : "");
  const [outAlert, setOutAlert] = useState(item.outOfStockAlert !== false);

  async function save() {
    const quantity = parseFloat(qty);
    if (!Number.isFinite(quantity) || quantity < 0) return;
    await db.foodItems.update(item.id, {
      quantity,
      lowStockThreshold: low ? parseFloat(low) : undefined,
      parLevel: par ? parseFloat(par) : undefined,
      quickAddAmount: quickAdd ? parseFloat(quickAdd) : undefined,
      quickConsumeAmount: quickUse ? parseFloat(quickUse) : undefined,
      outOfStockAlert: outAlert,
      updatedAt: Date.now(),
    });
    vibrate(30);
    onDone();
  }

  async function remove() {
    vibrate([20, 20, 20]);
    await db.foodItems.delete(item.id);
    onDelete();
  }

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "var(--surface-3)", border: "1px solid var(--border)" }}>
      <label style={labelStyle}>Quantity ({item.unit})</label>
      <input className="lock-input" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} style={{ marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Low stock at</label>
          <input className="lock-input" type="number" min={0} step="any" value={low} onChange={(e) => setLow(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Par level</label>
          <input className="lock-input" type="number" min={0} step="any" value={par} onChange={(e) => setPar(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Quick add</label>
          <input className="lock-input" type="number" min={0} step="any" value={quickAdd} onChange={(e) => setQuickAdd(e.target.value)} placeholder="Auto" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Quick use</label>
          <input className="lock-input" type="number" min={0} step="any" value={quickUse} onChange={(e) => setQuickUse(e.target.value)} placeholder="Auto" />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={outAlert} onChange={(e) => setOutAlert(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
        Alert when out of stock
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="tap-scale" onClick={() => void save()} style={{ ...primaryBtn, flex: 2 }}>
          Save
        </button>
        <button
          type="button"
          className="tap-scale"
          onClick={() => void remove()}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #EF444440",
            background: "#EF444415",
            color: "#EF4444",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function MealsTab({
  items,
  templates,
  today,
}: {
  items: FoodItem[];
  templates: MealTemplate[];
  today: string;
}) {
  const [mode, setMode] = useState<"templates" | "log" | "create">("templates");
  const [mealName, setMealName] = useState("");
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [tplName, setTplName] = useState("");
  const [tplEmoji, setTplEmoji] = useState("🍽️");
  const [tplIngredients, setTplIngredients] = useState<MealIngredient[]>([]);

  async function logMeal(ings: MealIngredient[], name: string) {
    setMsg(null);
    if (!name.trim()) {
      setMsg({ type: "err", text: "Name this meal" });
      return;
    }
    if (!ings.length) {
      setMsg({ type: "err", text: "Add at least one ingredient" });
      return;
    }
    const res = await logMealConsumption(name.trim(), ings, today);
    if (!res.ok) {
      setMsg({ type: "err", text: res.errors.join(" · ") });
      vibrate([30, 50, 30]);
      return;
    }
    vibrate(50);
    setMsg({ type: "ok", text: "Meal logged — inventory updated" });
    setMealName("");
    setIngredients([]);
    setMode("templates");
  }

  async function saveTemplate() {
    if (!tplName.trim() || !tplIngredients.length) return;
    await db.mealTemplates.put({
      id: crypto.randomUUID(),
      name: tplName.trim(),
      emoji: tplEmoji,
      ingredients: tplIngredients,
      createdAt: Date.now(),
    });
    vibrate(40);
    setTplName("");
    setTplIngredients([]);
    setMode("templates");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["templates", "log", "create"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setMsg(null);
            }}
            style={{
              flex: 1,
              padding: "8px 4px",
              borderRadius: 10,
              border: `1px solid ${mode === m ? "var(--accent)" : "var(--border)"}`,
              background: mode === m ? "var(--accent)20" : "var(--surface-3)",
              color: mode === m ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {m === "templates" ? "Templates" : m === "log" ? "Log meal" : "New template"}
          </button>
        ))}
      </div>

      {msg && (
        <p style={{ fontSize: 13, fontWeight: 600, color: msg.type === "ok" ? "var(--accent)" : "#F87171", marginBottom: 12 }}>
          {msg.text}
        </p>
      )}

      {mode === "templates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
          {templates.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No meal templates yet. Create one for meals you eat often.</p>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {t.emoji || "🍽️"} {t.name}
                  </span>
                  <button
                    type="button"
                    className="tap-scale"
                    onClick={() => void logMeal(ingredientsFromTemplate(t), t.name)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "var(--accent)",
                      border: "none",
                      color: "#000",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Log now
                  </button>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {t.ingredients.map((ing, i) => {
                    const food = items.find((f) => f.id === ing.foodItemId);
                    return (
                      <li key={i}>
                        {food?.name || "Unknown"}: {formatFoodQuantity(ing.amount, ing.unit)}
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={async () => {
                    vibrate(20);
                    await db.mealTemplates.delete(t.id);
                  }}
                  style={{
                    marginTop: 8,
                    padding: 0,
                    border: "none",
                    background: "none",
                    color: "#EF4444",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Delete template
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {mode === "log" && (
        <MealBuilder
          items={items}
          mealName={mealName}
          setMealName={setMealName}
          ingredients={ingredients}
          setIngredients={setIngredients}
          onSubmit={() => void logMeal(ingredients, mealName)}
        />
      )}

      {mode === "create" && (
        <div>
          <input className="lock-input" placeholder="Template name (e.g. Cereal bowl)" value={tplName} onChange={(e) => setTplName(e.target.value)} style={{ marginBottom: 10 }} />
          <MealBuilder
            items={items}
            mealName=""
            setMealName={() => {}}
            ingredients={tplIngredients}
            setIngredients={setTplIngredients}
            hideName
          />
          <button type="button" className="tap-scale" onClick={() => void saveTemplate()} style={{ ...primaryBtn, marginTop: 12 }}>
            Save template
          </button>
        </div>
      )}
    </div>
  );
}

function MealBuilder({
  items,
  mealName,
  setMealName,
  ingredients,
  setIngredients,
  onSubmit,
  hideName,
}: {
  items: FoodItem[];
  mealName: string;
  setMealName: (v: string) => void;
  ingredients: MealIngredient[];
  setIngredients: (v: MealIngredient[]) => void;
  onSubmit?: () => void;
  hideName?: boolean;
}) {
  const [foodId, setFoodId] = useState("");
  const [amt, setAmt] = useState("");
  const [unit, setUnit] = useState("g");

  const selected = items.find((i) => i.id === foodId);
  const kind = selected ? getUnitKind(selected.unit) : null;

  function addIngredient() {
    const amount = parseFloat(amt);
    if (!foodId || !Number.isFinite(amount) || amount <= 0) return;
    setIngredients([...ingredients, { foodItemId: foodId, amount, unit }]);
    setAmt("");
  }

  return (
    <div>
      {!hideName && (
        <>
          <label style={labelStyle}>Meal name</label>
          <input className="lock-input" value={mealName} onChange={(e) => setMealName(e.target.value)} placeholder="e.g. Breakfast cereal" style={{ marginBottom: 12 }} />
        </>
      )}
      <label style={labelStyle}>Ingredients</label>
      {ingredients.length > 0 && (
        <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
          {ingredients.map((ing, idx) => {
            const food = items.find((f) => f.id === ing.foodItemId);
            return (
              <li
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "var(--surface-2)",
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <span>
                  {food?.emoji} {food?.name}: {formatFoodQuantity(ing.amount, ing.unit)}
                </span>
                <button
                  type="button"
                  onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                  style={{ border: "none", background: "none", color: "#EF4444", cursor: "pointer", fontWeight: 700 }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Add foods to inventory first.</p>
      ) : (
        <>
          <select
            className="lock-input"
            value={foodId}
            onChange={(e) => {
              setFoodId(e.target.value);
              const f = items.find((i) => i.id === e.target.value);
              if (f) {
                const k = getUnitKind(f.unit);
                setUnit(f.unit);
                if (k === "volume" && f.unit === "L") setUnit("ml");
                if (k === "weight" && f.unit === "kg") setUnit("g");
              }
            }}
            style={{ marginBottom: 8 }}
          >
            <option value="">Pick food…</option>
            {items.map((f) => (
              <option key={f.id} value={f.id}>
                {f.emoji} {f.name} ({formatFoodQuantity(f.quantity, f.unit)} left)
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input className="lock-input" type="number" min={0} step="any" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} style={{ flex: 1 }} />
            <select
              className="lock-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ flex: 1 }}
              disabled={!kind}
            >
              {(kind ? unitsForKind(kind) : ["g"]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <button type="button" onClick={addIngredient} style={{ ...primaryBtn, width: "auto", padding: "0 16px", flexShrink: 0 }}>
              +
            </button>
          </div>
        </>
      )}
      {onSubmit && (
        <button type="button" className="tap-scale" onClick={onSubmit} style={{ ...primaryBtn, marginTop: 8 }}>
          Log meal & deduct stock
        </button>
      )}
    </div>
  );
}


const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 6,
};

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
