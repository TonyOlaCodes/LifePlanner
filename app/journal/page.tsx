"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect } from "react";
import { db, getTodayString } from "@/lib/db";
import { verifyJournalPassword, upgradeLegacyJournalPasswordIfNeeded } from "@/lib/journalAuth";
import { matchesJournalDailyUnlock } from "@/lib/journalUnlock";
import { vibrate, formatDate } from "@/lib/utils";
import BottomSheet from "@/components/ui/BottomSheet";
import { Plus, Trash2, Pencil } from "lucide-react";

const MOODS = [
  { score:9, emoji:"🤩", label:"Amazing" },
  { score:7, emoji:"😊", label:"Good" },
  { score:5, emoji:"😐", label:"Neutral" },
  { score:3, emoji:"😕", label:"Okay" },
  { score:1, emoji:"😞", label:"Bad" },
];

export default function JournalPage() {
  const today = getTodayString();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ content:"", moodScore:7, tags:"", date:today });

  // Edit state
  const [editId, setEditId] = useState<string|null>(null);
  const [editForm, setEditForm] = useState({ content:"", moodScore:7, tags:"", date:today });
  const [editing, setEditing] = useState(false);

  const entries = useLiveQuery(()=>db.journalEntries.orderBy("date").reverse().toArray(),[]);
  const editEntry = entries?.find(e=>e.id===editId);

  // Sync edit form when opening an entry
  useEffect(() => {
    if (editEntry && !editing) {
      setEditForm({
        content: editEntry.content,
        moodScore: editEntry.moodScore,
        tags: editEntry.tags.join(", "),
        date: editEntry.date || today,
      });
    }
  }, [editEntry, editing]);

  // If user selects a date that already has an entry, populate the form
  useEffect(() => {
    const existing = entries?.find(e => e.date === form.date);
    if (existing && form.content === "") {
      setForm(f => ({ ...f, content: existing.content, moodScore: existing.moodScore, tags: existing.tags.join(", ") }));
    }
  }, [form.date, entries]);

  async function addEntry() {
    vibrate(50);
    if (!form.content.trim()) return;
    const existing = entries?.find(e => e.date === (form.date || today));
    
    if (existing) {
      await db.journalEntries.update(existing.id, {
        content: form.content,
        moodScore: form.moodScore,
        tags: form.tags.split(",").map(t=>t.trim()).filter(Boolean),
      });
    } else {
      await db.journalEntries.put({
        id:crypto.randomUUID(), date:form.date || today, content:form.content,
        moodScore:form.moodScore, tags:form.tags.split(",").map(t=>t.trim()).filter(Boolean), createdAt:Date.now()
      });
    }
    setForm({ content:"", moodScore:7, tags:"", date:today });
    setAddOpen(false);
  }

  async function saveEdit() {
    if (!editId) return;
    vibrate(50);
    await db.journalEntries.update(editId, {
      content: editForm.content,
      moodScore: editForm.moodScore,
      tags: editForm.tags.split(",").map(t=>t.trim()).filter(Boolean),
      date: editForm.date,
    });
    setEditing(false);
  }

  async function deleteEntry(id:string) {
    vibrate([20,20,20]);
    await db.journalEntries.delete(id);
    setEditId(null);
    setEditing(false);
  }

  function openEntry(id: string) {
    setEditing(false);
    setEditId(id);
  }

  function closeEntry() {
    setEditId(null);
    setEditing(false);
  }

  const settings = useLiveQuery(()=>db.settings.get(1));
  const [unlocked, setUnlocked] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);

  if (settings?.journalPassword && !unlocked) {
    return (
      <div style={{ padding:"60px 20px", textAlign:"center", marginTop:"20vh" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🔒</div>
        <h1 style={{ fontSize:24, fontWeight:800 }}>Locked</h1>
        <p style={{ color:"var(--text-secondary)", fontSize:14, marginBottom:12 }}>Enter your journal password — or your daily key: letters/digits of your profile name plus today's date (day only), e.g. <b style={{color:"var(--text-primary)"}}>tony14</b> on the 14th.</p>
        <input type="password" value={passInput} onChange={e=>{setPassInput(e.target.value); setPassError(false);}} className="lock-input" style={{ textAlign:"center", letterSpacing:2, borderColor: passError ? "#EF4444" : undefined, fontSize:18 }} placeholder="Password or daily key" />
        {passError && <p style={{ color:"#EF4444", fontSize:12, marginTop:8 }}>Incorrect password or key</p>}
        <button className="tap-scale" onClick={async ()=>{
          const bypass = matchesJournalDailyUnlock(passInput, settings.userName || "");
          const ok = bypass || (await verifyJournalPassword(passInput, settings.journalPassword));
          if (ok) {
            if (!bypass) await upgradeLegacyJournalPasswordIfNeeded(passInput, settings.journalPassword);
            setUnlocked(true);
            setPassInput("");
          } else {
            setPassError(true); setPassInput(""); vibrate([30,50,30]);
          }
        }} style={{ padding:16, borderRadius:16, background:"var(--accent)", border:"none", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%", marginTop:16 }}>Unlock</button>
      </div>
    );
  }

  return (
    <div style={{ padding:"0 16px", paddingTop:16 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5, margin:0 }}>Journal 📓</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:13, margin:"4px 0 0" }}>{entries?.length||0} entries</p>
        </div>
        <button className="tap-scale" onClick={()=>setAddOpen(true)}
          style={{ width:44, height:44, borderRadius:14, background:"var(--accent)", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <Plus size={22} style={{color:"#000"}} />
        </button>
      </div>

      {/* Entries */}
      {(!entries||entries.length===0) ? (
        <div style={{ textAlign:"center", padding:"80px 20px" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>📓</div>
          <p style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Start journaling</p>
          <p style={{ color:"var(--text-secondary)", fontSize:14 }}>Reflect. Plan. Grow. Your thoughts, private and local.</p>
          <button onClick={()=>setAddOpen(true)} style={{ marginTop:20, padding:"14px 28px", borderRadius:16, background:"var(--accent)", border:"none", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer" }}>Write Today</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {entries.map(entry => {
            const mood = MOODS.find(m=>m.score<=entry.moodScore)?.emoji || "😐";
            const preview = entry.content.slice(0,120)+(entry.content.length>120?"...":"");
            return (
              <div key={entry.id} className="tap-scale" onClick={()=>openEntry(entry.id)}
                style={{ padding:"16px", borderRadius:20, background:"var(--surface-2)", border:"1px solid var(--border)", cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
                  <div>
                    <span style={{ fontSize:12, color:"var(--text-secondary)", fontWeight:600 }}>{formatDate(entry.date,"EEE, MMM d")}</span>
                    {entry.tags.length>0 && (
                      <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
                        {entry.tags.map(tag=>(
                          <span key={tag} style={{ fontSize:10, padding:"2px 8px", borderRadius:100, background:"var(--surface-3)", color:"var(--text-secondary)", fontWeight:600 }}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize:24 }}>{mood}</span>
                </div>
                <p style={{ margin:0, fontSize:14, color:"var(--text-secondary)", lineHeight:1.6 }}>{preview}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Entry Sheet */}
      <BottomSheet open={addOpen} onClose={()=>setAddOpen(false)} title="New Entry">
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Date</label>
            <input type="date" className="lock-input" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
          </div>
          <MoodPicker value={form.moodScore} onChange={v=>setForm(f=>({...f,moodScore:v}))} />
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Entry</label>
            <textarea className="lock-input" placeholder="What's on your mind? Reflect on the day, your goals, your mindset..." value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} style={{ minHeight:160 }} />
          </div>
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Tags (comma separated)</label>
            <input type="text" className="lock-input" placeholder="e.g. focus, discipline, grateful" value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} />
          </div>
          <button className="tap-scale" onClick={addEntry} style={{ padding:16, borderRadius:16, background:"var(--accent)", border:"none", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%", marginTop:8 }}>
            {entries?.find(e => e.date === (form.date || today)) ? "Update Entry" : "Save Entry"}
          </button>
        </div>
      </BottomSheet>

      {/* View / Edit Entry Sheet */}
      {editEntry && (
        <BottomSheet open={!!editId} onClose={closeEntry} title={formatDate(editEntry.date,"EEE, MMMM d yyyy")}>
          {editing ? (
            /* ===== EDIT MODE ===== */
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Date</label>
                <input type="date" className="lock-input" value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))} />
              </div>
              <MoodPicker value={editForm.moodScore} onChange={v=>setEditForm(f=>({...f,moodScore:v}))} />
              <div>
                <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Entry</label>
                <textarea className="lock-input" value={editForm.content} onChange={e=>setEditForm(f=>({...f,content:e.target.value}))} style={{ minHeight:180 }} />
              </div>
              <div>
                <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Tags (comma separated)</label>
                <input type="text" className="lock-input" value={editForm.tags} onChange={e=>setEditForm(f=>({...f,tags:e.target.value}))} />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="tap-scale" onClick={()=>setEditing(false)}
                  style={{ flex:1, padding:14, borderRadius:14, background:"var(--surface-3)", border:"1px solid var(--border)", color:"var(--text-secondary)", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                  Cancel
                </button>
                <button className="tap-scale" onClick={saveEdit}
                  style={{ flex:2, padding:14, borderRadius:14, background:"var(--accent)", border:"none", color:"#000", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            /* ===== VIEW MODE ===== */
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                <span style={{ fontSize:28 }}>{MOODS.find(m=>m.score<=editEntry.moodScore)?.emoji||"😐"}</span>
                <span style={{ fontSize:14, color:"var(--text-secondary)" }}>{MOODS.find(m=>m.score<=editEntry.moodScore)?.label}</span>
              </div>
              {editEntry.tags.length>0 && (
                <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
                  {editEntry.tags.map(tag=>(
                    <span key={tag} style={{ fontSize:11, padding:"3px 10px", borderRadius:100, background:"var(--surface-3)", color:"var(--text-secondary)", fontWeight:600 }}>#{tag}</span>
                  ))}
                </div>
              )}
              <p style={{ fontSize:15, lineHeight:1.8, color:"var(--text-primary)", whiteSpace:"pre-wrap", marginBottom:24 }}>{editEntry.content}</p>
              <div style={{ display:"flex", gap:8 }}>
                <button className="tap-scale" onClick={()=>setEditing(true)}
                  style={{ flex:1, padding:"12px 16px", borderRadius:14, background:"var(--accent)15", border:"1px solid var(--accent)30", color:"var(--accent)", fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <Pencil size={15} /> Edit Entry
                </button>
                <button className="tap-scale" onClick={()=>deleteEntry(editEntry.id)}
                  style={{ padding:"12px 16px", borderRadius:14, background:"#EF444415", border:"1px solid #EF444430", color:"#EF4444", fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}

/* Shared mood picker row */
function MoodPicker({ value, onChange }: { value:number; onChange:(v:number)=>void }) {
  return (
    <div>
      <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:10 }}>How are you feeling?</label>
      <div style={{ display:"flex", gap:8, justifyContent:"space-between" }}>
        {MOODS.map(m=>(
          <button key={m.score} onClick={()=>onChange(m.score)}
            style={{ flex:1, padding:"12px 4px", borderRadius:14, border:`1px solid ${value===m.score?"var(--accent)":"var(--border)"}`, background:value===m.score?"var(--accent)":"var(--surface-3)", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:20 }}>{m.emoji}</span>
            <span style={{ fontSize:9, fontWeight:700, color:value===m.score?"#000":"var(--text-tertiary)" }}>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
