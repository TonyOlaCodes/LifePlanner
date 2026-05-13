"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { vibrate } from "@/lib/utils";
import { Download, Upload, Trash2, Bell, Palette, User, Moon, Zap, ChevronRight, Lock } from "lucide-react";

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

export default function SettingsPage() {
  const settings = useLiveQuery(()=>db.settings.get(1),[]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [newPassword, setNewPassword] = useState("");

  if (!settings) return <div style={{ padding:40, textAlign:"center", color:"var(--text-secondary)" }}>Loading…</div>;

  async function update(patch: Partial<typeof settings>) {
    vibrate(30);
    await db.settings.update(1, patch as any);
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

  async function clearAllData() {
    if (!confirm("Are you sure? This will delete ALL your data permanently.")) return;
    await Promise.all([
      db.habits.clear(), db.habitLogs.clear(), db.sleepLogs.clear(),
      db.workoutLogs.clear(), db.tasks.clear(), db.journalEntries.clear(),
      db.disciplineLogs.clear(), db.exams.clear()
    ]);
    setExportMsg("All data cleared");
    setTimeout(()=>setExportMsg(""),3000);
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

      {/* Theme */}
      <Section title="Theme" icon={<Moon size={15}/>}>
        <div style={{ display:"flex", gap:8 }}>
          {([{v:"oled",l:"OLED Black"},{v:"dark",l:"Deep Dark"}] as const).map(t=>(
            <button key={t.v} onClick={()=>update({theme:t.v})}
              style={{ flex:1, padding:"12px 8px", borderRadius:14, border:`1px solid ${settings.theme===t.v?"var(--accent)":"var(--border)"}`, background:settings.theme===t.v?"var(--accent)":"var(--surface-3)", color:settings.theme===t.v?"#000":"var(--text-secondary)", fontWeight:700, fontSize:13, cursor:"pointer" }}>{t.l}</button>
          ))}
        </div>
      </Section>

      {/* Preferences */}
      <Section title="Preferences" icon={<Zap size={15}/>}>
        <ToggleRow label="Motivational quotes" value={settings.motivationalQuotes} onChange={v=>update({motivationalQuotes:v})} />
        <ToggleRow label="Haptic feedback" value={settings.haptics} onChange={v=>update({haptics:v})} />
      </Section>

      {/* Security */}
      <Section title="Security" icon={<Lock size={15}/>}>
        <p style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:8 }}>Journal Password</p>
        <div style={{ display:"flex", gap:8 }}>
          <input type="password" placeholder={settings.journalPassword ? "••••••••" : "No password set"} className="lock-input" value={newPassword} onChange={e=>setNewPassword(e.target.value)} style={{ flex:1 }} />
          <button className="tap-scale" onClick={async () => {
            if (!newPassword) {
              if (confirm("Remove journal password?")) {
                await update({ journalPassword: "" });
              }
            } else {
              await update({ journalPassword: newPassword });
              setNewPassword("");
              alert("Password saved!");
            }
          }} style={{ padding:"14px 18px", borderRadius:14, background:"var(--accent)", border:"none", color:"#000", fontWeight:700, fontSize:14, cursor:"pointer" }}>Save</button>
        </div>
        <p style={{ fontSize:11, color:"var(--text-tertiary)", marginTop:8 }}>To reset or remove the password, enter a new one or leave blank and click Save.</p>
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
          <button className="tap-scale" onClick={clearAllData}
            style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:"#EF444410", border:"1px solid #EF444420", cursor:"pointer", color:"#EF4444", fontSize:14, fontWeight:600 }}>
            <Trash2 size={18} /> Clear All Data
          </button>
        </div>
      </Section>

      <div style={{ textAlign:"center", paddingTop:20, paddingBottom:32 }}>
        <p style={{ color:"var(--text-tertiary)", fontSize:12 }}>Lock In — Local only. Your data stays on your device.</p>
        <p style={{ color:"var(--text-tertiary)", fontSize:11, marginTop:4 }}>v1.0.0</p>
      </div>
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

function ToggleRow({ label, value, onChange }: { label:string; value:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:14, marginBottom:14, borderBottom:"1px solid var(--border)" }}>
      <span style={{ fontSize:14, fontWeight:500 }}>{label}</span>
      <button onClick={()=>onChange(!value)}
        style={{ width:48, height:28, borderRadius:100, background:value?"var(--accent)":"var(--surface-3)", border:`1px solid ${value?"var(--accent)":"var(--border)"}`, cursor:"pointer", position:"relative", transition:"all 0.25s ease" }}>
        <div style={{ width:22, height:22, borderRadius:"50%", background:value?"#000":"var(--text-tertiary)", position:"absolute", top:2, left:value?22:2, transition:"left 0.25s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </button>
    </div>
  );
}
