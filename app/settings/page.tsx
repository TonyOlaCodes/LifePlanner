"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect } from "react";
import { db, initializeSettings, type JournalSecuritySnapshot } from "@/lib/db";
import { vibrate } from "@/lib/utils";
import BottomSheet from "@/components/ui/BottomSheet";
import { hashJournalPassword, verifyJournalPassword } from "@/lib/journalAuth";
import { Download, Upload, Trash2, Palette, User, Target, Lock, LayoutGrid } from "lucide-react";

const CLEAR_CONFIRM_PHRASE = "CLEAR ALL DATA";

const ACCENT_PRESETS = [
  { name:"Emerald", value:"#6EE7B7" },
  { name:"Cyan",    value:"#22D3EE" },
  { name:"Purple",  value:"#A78BFA" },
  { name:"Pink",    value:"#F472B6" },
  { name:"Orange",  value:"#FB923C" },
  { name:"Gold",    value:"#FBBF24" },
  { name:"Red",     value:"#F87171" },
  { name:"Blue",    value:"#60A5FA" },
  { name:"Lime",    value:"#A3E635" },
  { name:"White",   value:"#E4E4E7" },
];

const FORGOT_JOURNAL_PHRASE = "RESET MY JOURNAL LOCK";
const CLEAR_GROUPS = [
  { key: "habits", label: "Habits + habit logs" },
  { key: "tasks", label: "Tasks" },
  { key: "journal", label: "Journal" },
  { key: "focus", label: "Deep work" },
  { key: "health", label: "Sleep, weight, calories" },
  { key: "workouts", label: "Workouts + records" },
  { key: "food", label: "Food inventory + meals" },
  { key: "settings", label: "Settings" },
] as const;

export default function SettingsPage() {
  const settings = useLiveQuery(()=>db.settings.get(1),[]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [clearSheetOpen, setClearSheetOpen] = useState(false);
  const [clearPhraseInput, setClearPhraseInput] = useState("");
  const [clearGroups, setClearGroups] = useState<Record<(typeof CLEAR_GROUPS)[number]["key"], boolean>>({
    habits: true,
    tasks: true,
    journal: true,
    focus: true,
    health: true,
    workouts: true,
    food: true,
    settings: true,
  });
  const [journalCurrent, setJournalCurrent] = useState("");
  const [journalNew, setJournalNew] = useState("");
  const [journalConfirm, setJournalConfirm] = useState("");
  const [journalNote, setJournalNote] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [forgotJournalOpen, setForgotJournalOpen] = useState(false);
  const [forgotJournalPhrase, setForgotJournalPhrase] = useState("");
  const [focusDaily, setFocusDaily] = useState("60");
  const [focusWeekly, setFocusWeekly] = useState("360");
  const [focusMonthly, setFocusMonthly] = useState("1400");
  const [focusShowDaily, setFocusShowDaily] = useState(true);
  const [focusShowWeekly, setFocusShowWeekly] = useState(true);
  const [focusShowMonthly, setFocusShowMonthly] = useState(true);

  useEffect(() => {
    if (!settings) return;
    setFocusDaily(String(settings.focusGoalDailyMinutes ?? 60));
    setFocusWeekly(String(settings.focusGoalWeeklyMinutes ?? 360));
    setFocusMonthly(String(settings.focusGoalMonthlyMinutes ?? 1400));
    setFocusShowDaily(settings.focusShowDailyBar !== false);
    setFocusShowWeekly(settings.focusShowWeeklyBar !== false);
    setFocusShowMonthly(settings.focusShowMonthlyBar !== false);
  }, [settings]);

  if (!settings) return <div style={{ padding:40, textAlign:"center", color:"var(--text-secondary)" }}>Loading…</div>;

  async function update(patch: Partial<typeof settings>) {
    vibrate(30);
    await db.settings.update(1, patch as any);
  }

  async function saveJournalLock() {
    const s = settings;
    if (!s) return;
    setJournalNote(null);
    const hasLock = !!s.journalPassword?.length;
    if (hasLock) {
      const curOk = await verifyJournalPassword(journalCurrent, s.journalPassword);
      if (!curOk) {
        setJournalNote({ type: "err", text: "Current phrase is wrong." });
        vibrate([40, 40, 40]);
        return;
      }
      if (!journalNew.trim()) {
        setJournalNote({ type: "err", text: "Enter a new phrase to change it, or use “Locked out?” to remove the lock." });
        return;
      }
      if (journalNew !== journalConfirm) {
        setJournalNote({ type: "err", text: "New phrases do not match." });
        return;
      }
      if (journalNew.length < 4) {
        setJournalNote({ type: "err", text: "Use at least 4 characters." });
        return;
      }
      const hashed = await hashJournalPassword(journalNew);
      await db.settings.update(1, { journalPassword: hashed });
      setJournalCurrent("");
      setJournalNew("");
      setJournalConfirm("");
      setJournalNote({ type: "ok", text: "Journal lock updated." });
      vibrate(40);
      return;
    }
    if (!journalNew.trim()) {
      setJournalNote({ type: "err", text: "Choose a phrase." });
      return;
    }
    if (journalNew !== journalConfirm) {
      setJournalNote({ type: "err", text: "Phrases do not match." });
      return;
    }
    if (journalNew.length < 4) {
      setJournalNote({ type: "err", text: "Use at least 4 characters." });
      return;
    }
    const hashed = await hashJournalPassword(journalNew);
    await db.settings.update(1, { journalPassword: hashed });
    setJournalNew("");
    setJournalConfirm("");
    setJournalNote({ type: "ok", text: "Journal lock created (stored on this device only)." });
    vibrate(40);
  }

  async function confirmForgotJournal() {
    if (forgotJournalPhrase !== FORGOT_JOURNAL_PHRASE) return;
    vibrate([50, 50, 50]);
    await db.journalEntries.clear();
    await db.settings.update(1, { journalPassword: "" });
    setForgotJournalOpen(false);
    setForgotJournalPhrase("");
    setJournalCurrent("");
    setJournalNew("");
    setJournalConfirm("");
    setJournalNote({ type: "ok", text: "Journal lock removed and all journal entries were deleted." });
  }

  const quickKeys = settings!.quickLogKeys ?? (["sleep", "workout", "weight", "calories"] as const);
  const QUICK_OPTIONS = [
    { key: "sleep" as const, label: "Sleep" },
    { key: "workout" as const, label: "Workout" },
    { key: "weight" as const, label: "Weight" },
    { key: "calories" as const, label: "Calories" },
  ];

  function toggleQuickKey(key: (typeof QUICK_OPTIONS)[number]["key"]) {
    const s = settings;
    if (!s) return;
    const set = new Set(s.quickLogKeys ?? ["sleep", "workout", "weight", "calories"]);
    if (set.has(key)) {
      if (set.size <= 1) {
        setJournalNote({ type: "err", text: "Keep at least one quick-log button on Home." });
        return;
      }
      set.delete(key);
    } else set.add(key);
    void update({ quickLogKeys: [...set] as ("sleep" | "workout" | "weight" | "calories")[] });
  }

  async function saveFocusGoals() {
    vibrate(30);
    const d = Math.max(1, parseInt(focusDaily, 10) || 60);
    const w = Math.max(1, parseInt(focusWeekly, 10) || 360);
    const m = Math.max(1, parseInt(focusMonthly, 10) || 1400);
    await db.settings.update(1, {
      focusGoalDailyMinutes: d,
      focusGoalWeeklyMinutes: w,
      focusGoalMonthlyMinutes: m,
      focusShowDailyBar: focusShowDaily,
      focusShowWeeklyBar: focusShowWeekly,
      focusShowMonthlyBar: focusShowMonthly,
    });
    setJournalNote({ type: "ok", text: "Focus goals saved." });
    setTimeout(() => setJournalNote(null), 2500);
  }

  async function saveName() {
    if (!name.trim()) return;
    vibrate(40);
    setSaving(true);
    await db.settings.update(1, { userName: name.trim() });
    setSaving(false);
    setName("");
  }

  async function exportData() {
    const [habits,logs,sleep,workouts,tasks,journal,discipline,exams] = await Promise.all([
      db.habits.toArray(), db.habitLogs.toArray(), db.sleepLogs.toArray(),
      db.workoutLogs.toArray(), db.tasks.toArray(), db.journalEntries.toArray(),
      db.disciplineLogs.toArray(), db.exams.toArray()
    ]);
    const blob = new Blob([JSON.stringify({ habits,logs,sleep,workouts,tasks,journal,discipline,exams,exportedAt:new Date().toISOString() },null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`lockin-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    setExportMsg("Data exported successfully ✓");
    setTimeout(()=>setExportMsg(""),3000);
  }

  async function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (data.habits) await db.habits.bulkPut(data.habits);
      if (data.logs) await db.habitLogs.bulkPut(data.logs);
      if (data.sleep) await db.sleepLogs.bulkPut(data.sleep);
      if (data.workouts) await db.workoutLogs.bulkPut(data.workouts);
      if (data.tasks) await db.tasks.bulkPut(data.tasks);
      if (data.journal) await db.journalEntries.bulkPut(data.journal);
      setExportMsg("Data imported successfully ✓");
      setTimeout(()=>setExportMsg(""),3000);
    } catch {
      setExportMsg("Import failed — invalid file");
      setTimeout(()=>setExportMsg(""),3000);
    }
  }

  async function clearAllDataConfirmed() {
    if (clearPhraseInput !== CLEAR_CONFIRM_PHRASE) return;
    vibrate([35, 35, 35]);
    const clears: Promise<unknown>[] = [];
    if (clearGroups.habits) clears.push(db.habits.clear(), db.habitLogs.clear());
    if (clearGroups.tasks) clears.push(db.tasks.clear(), db.plannerItems.clear());
    if (clearGroups.journal) clears.push(db.journalEntries.clear(), db.journalSecuritySnapshots.clear());
    if (clearGroups.focus) clears.push(db.focusDaily.clear());
    if (clearGroups.health) clears.push(db.sleepLogs.clear(), db.metricsLogs.clear());
    if (clearGroups.workouts) clears.push(db.workoutLogs.clear(), db.personalRecords.clear(), db.studySessions.clear(), db.exams.clear());
    if (clearGroups.food) clears.push(db.foodItems.clear(), db.mealTemplates.clear(), db.mealLogs.clear());
    if (clearGroups.settings) clears.push(db.settings.clear());
    clears.push(db.disciplineLogs.clear(), db.contentPosts.clear());
    await Promise.all(clears);
    if (clearGroups.settings) await initializeSettings();
    setClearSheetOpen(false);
    setClearPhraseInput("");
    setExportMsg(clearGroups.settings ? "Selected data was reset. Settings restored to defaults." : "Selected data was reset.");
    setTimeout(() => setExportMsg(""), 5000);
  }

  return (
    <div style={{ padding:"0 16px", paddingTop:16 }}>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5, margin:0 }}>Settings ⚙️</h1>
        <p style={{ color:"var(--text-secondary)", fontSize:13, margin:"4px 0 0" }}>Personalise your Lock In</p>
      </div>

      {/* Profile */}
      <Section title="Profile" icon={<User size={15}/>}>
        <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:8 }}>Name — showing as "{settings.userName}"</p>
        <div style={{ display:"flex", gap:8 }}>
          <input type="text" className="lock-input" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={{ flex:1 }} />
          <button className="tap-scale" onClick={saveName} style={{ padding:"14px 18px", borderRadius:14, background:"var(--accent)", border:"none", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer" }}>Save</button>
        </div>
      </Section>

      {/* Accent Color */}
      <Section title="Accent Color" icon={<Palette size={15}/>}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {ACCENT_PRESETS.map(p => (
            <button key={p.value} onClick={()=>update({accentColor:p.value})} title={p.name}
              style={{ width:36, height:36, borderRadius:"50%", background:p.value, border:`3px solid ${settings.accentColor===p.value?"white":"transparent"}`, cursor:"pointer", transition:"border 0.15s ease", boxShadow:settings.accentColor===p.value?`0 0 12px ${p.value}80`:"none" }} />
          ))}
        </div>
        <div style={{ marginTop:14 }}>
          <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:8 }}>Custom hex color</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input type="color" value={settings.accentColor} onChange={e=>update({accentColor:e.target.value})}
              style={{ width:48, height:44, borderRadius:12, border:"1px solid var(--border)", background:"none", cursor:"pointer", padding:2 }} />
            <input type="text" className="lock-input" value={settings.accentColor} onChange={e=>update({accentColor:e.target.value})} style={{ flex:1, fontFamily:"monospace" }} />
          </div>
        </div>
      </Section>

      {/* Focus goals */}
      <Section title="Focus goals" icon={<Target size={15} />}>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.45 }}>
          Minute targets for Focus. Check which bars show on that tab.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "10px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={focusShowDaily} onChange={(e) => setFocusShowDaily(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--accent)" }} />
              Day
            </label>
            <input type="number" min={1} className="lock-input" value={focusDaily} onChange={(e) => setFocusDaily(e.target.value)} style={{ width: 80, padding: "8px 8px", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={focusShowWeekly} onChange={(e) => setFocusShowWeekly(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--accent)" }} />
              Week
            </label>
            <input type="number" min={1} className="lock-input" value={focusWeekly} onChange={(e) => setFocusWeekly(e.target.value)} style={{ width: 80, padding: "8px 8px", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={focusShowMonthly} onChange={(e) => setFocusShowMonthly(e.target.checked)} style={{ width: 14, height: 14, accentColor: "var(--accent)" }} />
              Month
            </label>
            <input type="number" min={1} className="lock-input" value={focusMonthly} onChange={(e) => setFocusMonthly(e.target.value)} style={{ width: 80, padding: "8px 8px", fontSize: 13 }} />
          </div>
          <button type="button" className="tap-scale" onClick={() => void saveFocusGoals()}
            style={{ padding: "10px 16px", borderRadius: 12, background: "var(--accent)", border: "none", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", marginLeft: "auto" }}>
            Save
          </button>
        </div>
      </Section>

      {/* Security — journal lock */}
      <Section title="Security" icon={<Lock size={15}/>}>
        <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.5, margin:"0 0 14px" }}>
          Journal lock is stored only on this device. To change it, enter what you use now. If you are locked out, use the recovery flow below (it deletes journal entries).
        </p>
        {settings.journalPassword ? (
          <>
            <label style={{ fontSize:12, color:"var(--text-tertiary)", display:"block", marginBottom:6 }}>Current phrase</label>
            <input type="password" className="lock-input" value={journalCurrent} onChange={(e) => setJournalCurrent(e.target.value)} style={{ marginBottom:12 }} autoComplete="off" />
            <label style={{ fontSize:12, color:"var(--text-tertiary)", display:"block", marginBottom:6 }}>New phrase</label>
            <input type="password" className="lock-input" value={journalNew} onChange={(e) => setJournalNew(e.target.value)} style={{ marginBottom:12 }} autoComplete="off" />
            <label style={{ fontSize:12, color:"var(--text-tertiary)", display:"block", marginBottom:6 }}>Confirm new phrase</label>
            <input type="password" className="lock-input" value={journalConfirm} onChange={(e) => setJournalConfirm(e.target.value)} style={{ marginBottom:12 }} autoComplete="off" />
          </>
        ) : (
          <>
            <label style={{ fontSize:12, color:"var(--text-tertiary)", display:"block", marginBottom:6 }}>Create phrase</label>
            <input type="password" className="lock-input" value={journalNew} onChange={(e) => setJournalNew(e.target.value)} style={{ marginBottom:12 }} autoComplete="off" />
            <label style={{ fontSize:12, color:"var(--text-tertiary)", display:"block", marginBottom:6 }}>Confirm phrase</label>
            <input type="password" className="lock-input" value={journalConfirm} onChange={(e) => setJournalConfirm(e.target.value)} style={{ marginBottom:12 }} autoComplete="off" />
          </>
        )}
        <button type="button" className="tap-scale" onClick={() => void saveJournalLock()}
          style={{ width:"100%", padding:14, borderRadius:14, background:"var(--accent)", border:"none", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:10 }}>
          {settings.journalPassword ? "Update journal lock" : "Create journal lock"}
        </button>
        {settings.journalPassword && (
          <button type="button" className="tap-scale" onClick={() => { setForgotJournalPhrase(""); setForgotJournalOpen(true); }}
            style={{ width:"100%", padding:12, borderRadius:12, background:"transparent", border:"1px solid var(--border)", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Locked out?
          </button>
        )}
        {journalNote && (
          <p style={{ margin:"12px 0 0", fontSize:13, fontWeight:600, color: journalNote.type === "ok" ? "var(--accent)" : "#F87171" }}>{journalNote.text}</p>
        )}
        {settings.journalPassword ? <JournalUnlockSnapshots /> : null}
      </Section>

      <Section title="Home quick log" icon={<LayoutGrid size={15}/>}>
        <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:12 }}>Choose which buttons show on the dashboard row (at least one).</p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {QUICK_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => toggleQuickKey(o.key)}
              style={{
                padding:"10px 14px",
                borderRadius:12,
                border:`1px solid ${quickKeys.includes(o.key) ? "var(--accent)" : "var(--border)"}`,
                background: quickKeys.includes(o.key) ? "var(--accent)" : "var(--surface-3)",
                color: quickKeys.includes(o.key) ? "#000" : "var(--text-secondary)",
                fontWeight:600,
                fontSize:13,
                cursor:"pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Data */}
      <Section title="Data & Backup" icon={<Download size={15}/>}>
        {exportMsg && <div style={{ marginBottom:12, padding:"10px 14px", borderRadius:12, background:"var(--accent)20", border:"1px solid var(--accent)40", fontSize:13, color:"var(--accent)", fontWeight:600 }}>{exportMsg}</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <button className="tap-scale" onClick={exportData}
            style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:"var(--surface-2)", border:"1px solid var(--border)", cursor:"pointer", color:"var(--text-primary)", fontSize:14, fontWeight:600 }}>
            <Download size={18} style={{color:"var(--accent)"}} /> Export All Data (JSON)
          </button>
          <label className="tap-scale"
            style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:"var(--surface-2)", border:"1px solid var(--border)", cursor:"pointer", color:"var(--text-primary)", fontSize:14, fontWeight:600 }}>
            <Upload size={18} style={{color:"#8B5CF6"}} /> Import Data from JSON
            <input type="file" accept=".json" style={{ display:"none" }} onChange={importData} />
          </label>
          <button className="tap-scale" onClick={() => { setClearPhraseInput(""); setClearSheetOpen(true); }}
            style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:"#EF444410", border:"1px solid #EF444420", cursor:"pointer", color:"#EF4444", fontSize:14, fontWeight:600 }}>
            <Trash2 size={18} /> Clear All Data
          </button>
        </div>
      </Section>

      <BottomSheet open={forgotJournalOpen} onClose={() => { setForgotJournalOpen(false); setForgotJournalPhrase(""); }} title="Remove journal lock">
        <p style={{ fontSize:14, color:"var(--text-secondary)", lineHeight:1.55, margin:"0 0 12px" }}>
          This permanently deletes <span style={{ fontWeight: 800 }}>all journal entries</span> and removes the lock. There is no recovery. Type exactly:
        </p>
        <p style={{ fontSize:12, fontWeight:800, color:"#F87171", margin:"0 0 10px", letterSpacing:0.2 }}>{FORGOT_JOURNAL_PHRASE}</p>
        <input
          type="text"
          className="lock-input"
          autoComplete="off"
          spellCheck={false}
          value={forgotJournalPhrase}
          onChange={(e) => setForgotJournalPhrase(e.target.value)}
          style={{ marginBottom:14 }}
        />
        <button
          type="button"
          className="tap-scale"
          disabled={forgotJournalPhrase !== FORGOT_JOURNAL_PHRASE}
          onClick={() => void confirmForgotJournal()}
          style={{
            width:"100%",
            padding:14,
            borderRadius:14,
            background: forgotJournalPhrase === FORGOT_JOURNAL_PHRASE ? "#DC2626" : "var(--surface-3)",
            border:"1px solid rgba(239,68,68,0.35)",
            color: forgotJournalPhrase === FORGOT_JOURNAL_PHRASE ? "#fff" : "var(--text-tertiary)",
            fontWeight:700,
            cursor: forgotJournalPhrase === FORGOT_JOURNAL_PHRASE ? "pointer" : "not-allowed",
          }}
        >
          Delete all journal entries and remove lock
        </button>
      </BottomSheet>

      <BottomSheet open={clearSheetOpen} onClose={() => { setClearSheetOpen(false); setClearPhraseInput(""); }} title="Erase everything?">
        <p style={{ fontSize:14, color:"var(--text-secondary)", lineHeight:1.5, margin:"0 0 12px" }}>
          Choose what to delete, then type the phrase below exactly (all caps) to confirm.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
          {CLEAR_GROUPS.map((group) => (
            <label key={group.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 8px", borderRadius:12, background:"var(--surface-2)", border:"1px solid var(--border)", color:"var(--text-secondary)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              <input
                type="checkbox"
                checked={clearGroups[group.key]}
                onChange={(e) => setClearGroups((g) => ({ ...g, [group.key]: e.target.checked }))}
                style={{ width:16, height:16, accentColor:"#EF4444", flexShrink:0 }}
              />
              {group.label}
            </label>
          ))}
        </div>
        <p style={{ fontSize:12, fontWeight:700, color:"#F87171", margin:"0 0 8px", letterSpacing:0.3 }}>{CLEAR_CONFIRM_PHRASE}</p>
        <input
          type="text"
          className="lock-input"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={CLEAR_CONFIRM_PHRASE}
          value={clearPhraseInput}
          onChange={(e) => setClearPhraseInput(e.target.value)}
          style={{ marginBottom:14 }}
        />
        <button
          className="tap-scale"
          onClick={clearAllDataConfirmed}
          disabled={clearPhraseInput !== CLEAR_CONFIRM_PHRASE}
          style={{
            padding:16,
            borderRadius:14,
            background: clearPhraseInput === CLEAR_CONFIRM_PHRASE ? "#DC2626" : "var(--surface-3)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: clearPhraseInput === CLEAR_CONFIRM_PHRASE ? "#fff" : "var(--text-tertiary)",
            fontSize:15,
            fontWeight:700,
            cursor: clearPhraseInput === CLEAR_CONFIRM_PHRASE ? "pointer" : "not-allowed",
            width:"100%",
          }}
        >
          Reset device data
        </button>
      </BottomSheet>

      <div style={{ textAlign:"center", paddingTop:20, paddingBottom:32 }}>
        <p style={{ color:"var(--text-tertiary)", fontSize:12 }}>Lock In — Local only. Your data stays on your device.</p>
        <p style={{ color:"var(--text-tertiary)", fontSize:11, marginTop:4 }}>v1.0.0</p>
      </div>
    </div>
  );
}

function JournalUnlockSnapshots() {
  const snapshots = useLiveQuery(
    () => db.journalSecuritySnapshots.orderBy("createdAt").reverse().toArray(),
    [],
  );

  async function clearSnapshots() {
    vibrate(30);
    await db.journalSecuritySnapshots.clear();
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5, margin: "0 0 12px" }}>
        Failed journal unlock attempts capture a front-camera photo on this device (up to 30). Grant camera permission when prompted.
      </p>
      {!snapshots?.length ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>No failed unlock photos yet.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {snapshots.map((snap) => (
              <SnapshotThumb key={snap.id} snap={snap} />
            ))}
          </div>
          <button
            type="button"
            className="tap-scale"
            onClick={() => void clearSnapshots()}
            style={{
              width: "100%",
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear all photos
          </button>
        </>
      )}
    </div>
  );
}

function SnapshotThumb({ snap }: { snap: JournalSecuritySnapshot }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(snap.imageBlob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [snap.id, snap.imageBlob]);

  const when = new Date(snap.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface-3)" }}>
      {url ? (
        <img src={url} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: "3/4", background: "var(--surface-2)" }} />
      )}
      <p style={{ margin: 0, padding: "6px 8px", fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600, textAlign: "center" }}>
        {when}
      </p>
    </div>
  );
}

function Section({ title, icon, children }: { title:string; icon:React.ReactNode; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
        <span style={{ color:"var(--accent)" }}>{icon}</span>
        <h2 style={{ fontSize:12, fontWeight:700, margin:0, textTransform:"uppercase", letterSpacing:1, color:"var(--text-secondary)" }}>{title}</h2>
      </div>
      <div className="glass" style={{ borderRadius:20, padding:"16px" }}>{children}</div>
    </div>
  );
}
