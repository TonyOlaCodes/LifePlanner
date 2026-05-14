"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, getTodayString, getStreakForHabit, type Habit } from "@/lib/db";
import { CATEGORY_CONFIG, vibrate } from "@/lib/utils";
import BottomSheet from "@/components/ui/BottomSheet";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { format, subDays, startOfWeek, subWeeks, addDays } from "date-fns";

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS = ["M","T","W","T","F","S","S"];
const COLORS = [
  "#4ADE80", // bright green
  "#60A5FA", // bright blue
  "#F87171", // bright red
  "#FBBF24", // bright amber
  "#A78BFA", // bright purple
  "#22D3EE", // bright cyan
  "#F472B6", // bright pink
  "#FB923C", // bright orange
  "#FDE047", // bright yellow
  "#818CF8", // bright indigo
];

const EMOJI_LIST = [
  "🔥","⭐","💪","🏆","🎯","✅","🚀","💡","🧠","📈",
  "🙏","📖","✝️","☪️","🕊️","💫","🌟","🕌",
  "😴","🌙","💤","🛌","🧘","🫁","🩺","💊",
  "📚","📝","🎓","📐","🔬","🖊️","📓","🗂️",
  "💻","🖥️","⌨️","🐛","🔧","📡","🤖","🛠️",
  "🏋️","🤸","🏃","🚴","⚽","🏀","🥊","🎽",
  "🥗","💧","🍎","☕","🫖","🧃","🍳","🥦",
  "📵","🚫","🛑","🧊","⛔","🔒","🎖️","🥷",
  "🎥","📸","🎙️","🎨","✍️","🎬","📢","🎵",
  "❤️","🌱","🦁","⚡","🌊","🌸","🎁","🏅",
];

type ViewMode = "weekly" | "monthly";

export default function HabitsPage() {
  const today = getTodayString();
  const TODAY_KEY = ["sun","mon","tue","wed","thu","fri","sat"][new Date().getDay()];

  const [viewMode, setViewMode] = useState<ViewMode>("weekly");

  const [addOpen, setAddOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editEmojiOpen, setEditEmojiOpen] = useState(false);
  const [form, setForm] = useState({ title:"", emoji:"⭐", category:"custom" as Habit["category"], frequency: [...DAYS], color: COLORS[0] });
  /** One object so active days / color / emoji stay in sync when opening edit (avoids stale split state). */
  const [habitEdit, setHabitEdit] = useState<{
    id: string;
    title: string;
    emoji: string;
    frequency: string[];
    color: string;
  } | null>(null);

  const habits = useLiveQuery(() => db.habits.orderBy("order").toArray(), []);
  const todayLogs = useLiveQuery(() => db.habitLogs.where("date").equals(today).toArray(), [today]);
  const allLogs = useLiveQuery(() => db.habitLogs.toArray(), []);
  const settings = useLiveQuery(() => db.settings.get(1), []);
  const accountStart = settings?.accountStartDate ?? today;

  const todayHabits = (habits || []).filter((h) => Array.isArray(h.frequency) && h.frequency.includes(TODAY_KEY));
  const completedIdsToday = (todayLogs || []).filter((l) => l.completed).map((l) => l.habitId);

  // Weekly: Last 7 days
  const last7 = Array.from({ length:7 }, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i);
    return d.toISOString().split("T")[0];
  });

  // Monthly: 4 aligned weeks ending this week
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const fourWeeksAgo = subWeeks(currentWeekStart, 3);
  const last28 = Array.from({ length:28 }, (_,i) => {
    return format(addDays(fourWeeksAgo, i), "yyyy-MM-dd");
  });

  async function toggleHabit(habitId: string) {
    vibrate(40);
    const existing = (todayLogs||[]).find(l => l.habitId === habitId);
    if (existing) await db.habitLogs.update(existing.id, { completed: !existing.completed });
    else await db.habitLogs.put({ id: crypto.randomUUID(), habitId, date: today, completed: true, timestamp: Date.now() });
  }

  async function addHabit() {
    vibrate(50);
    if (!form.title.trim()) return;
    const count = await db.habits.count();
    await db.habits.put({
      id: crypto.randomUUID(), title: form.title.trim(), emoji: form.emoji,
      category: form.category, frequency: form.frequency, color: form.color,
      order: count, createdAt: Date.now(), archived: 0 as 0 | 1,
    });
    setForm({ title:"", emoji:"⭐", category:"custom", frequency:[...DAYS], color:COLORS[0] });
    setEmojiOpen(false);
    setAddOpen(false);
  }

  async function saveEdit() {
    if (!habitEdit) return;
    vibrate(50);
    await db.habits.update(habitEdit.id, {
      emoji: habitEdit.emoji,
      frequency: habitEdit.frequency,
      color: habitEdit.color,
    });
    setEditEmojiOpen(false);
    setHabitEdit(null);
  }

  async function deleteHabit(id: string) {
    vibrate([30,30,30]);
    await db.habits.delete(id);
    await db.habitLogs.where("habitId").equals(id).delete();
  }

  function openEdit(habit: Habit, e: React.MouseEvent) {
    e.stopPropagation();
    const raw = habit.frequency;
    const frequency = Array.isArray(raw)
      ? DAYS.filter((d) => raw.includes(d))
      : [];
    setEditEmojiOpen(false);
    setHabitEdit({
      id: habit.id,
      title: habit.title,
      emoji: habit.emoji,
      frequency,
      color: habit.color,
    });
  }

  function toggleFormDay(day: string) {
    setForm(f => ({ ...f, frequency: f.frequency.includes(day) ? f.frequency.filter(d=>d!==day) : [...f.frequency, day] }));
  }

  function toggleEditDay(day: string) {
    setHabitEdit((f) => {
      if (!f) return f;
      const frequency = f.frequency.includes(day) ? f.frequency.filter((d) => d !== day) : [...f.frequency, day];
      return { ...f, frequency };
    });
  }

  const grouped = Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
    const catHabits = (habits || []).filter((h) => h.category === key);
    const sorted = [
      ...catHabits.filter((h) => !completedIdsToday.includes(h.id)),
      ...catHabits.filter((h) => completedIdsToday.includes(h.id)),
    ];
    return { key, cfg, habits: sorted };
  }).filter((g) => g.habits.length > 0);

  return (
    <div style={{ padding:"0 16px", paddingTop:16 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5, margin:0 }}>Habits 🔥</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:13, margin:"4px 0 0" }}>
            {(todayLogs || []).filter((l) => l.completed).length}/{todayHabits.length} done today
          </p>
        </div>
        <button className="tap-scale" onClick={()=>setAddOpen(true)}
          style={{ width:44, height:44, borderRadius:14, background:"var(--accent)", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <Plus size={22} style={{color:"#000"}} />
        </button>
      </div>

      {/* View Toggle */}
      <div style={{ display:"flex", gap:6, marginBottom:24 }}>
        {(["weekly","monthly"] as ViewMode[]).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} className="tap-scale"
            style={{ flex:1, padding:"10px 0", borderRadius:14, border:`1px solid ${viewMode===mode?"var(--accent)":"var(--border)"}`, background:viewMode===mode?"var(--accent)":"var(--surface-2)", color:viewMode===mode?"#000":"var(--text-secondary)", fontWeight:700, fontSize:13, cursor:"pointer", textTransform:"capitalize" }}>
            {mode}
          </button>
        ))}
      </div>

      {/* Habit Groups */}
      {grouped.map(({ key, cfg, habits: catHabits }) => (
        <section key={key} style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:18 }}>{cfg.emoji}</span>
            <h2 style={{ fontSize:14, fontWeight:700, margin:0, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:1 }}>{cfg.label}</h2>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {catHabits.map(habit => {
              const done = (todayLogs || []).some((l) => l.habitId === habit.id && l.completed);
              const streak = getStreakForHabit(allLogs||[], habit.id);
              const logMap = Object.fromEntries((allLogs||[]).filter(l=>l.habitId===habit.id).map(l=>[l.date,l.completed]));
              
              // Only apply partial opacity if the habit is NOT scheduled for today
              const isScheduledToday = Array.isArray(habit.frequency) && habit.frequency.includes(TODAY_KEY);

              return (
                <div key={habit.id} className="tap-scale" onClick={()=>toggleHabit(habit.id)}
                  style={{
                    borderRadius:20,
                    background: done ? `${habit.color}22` : `linear-gradient(145deg, ${habit.color}2a 0%, var(--surface-2) 42%, var(--surface-2) 100%)`,
                    border: `1px solid ${done ? habit.color + "55" : habit.color + "38"}`,
                    boxShadow: done ? `inset 0 0 0 1px ${habit.color}30` : `0 0 0 1px ${habit.color}14`,
                    overflow:"hidden",
                    opacity: done ? 0.72 : 1,
                    transition:"all 0.25s ease",
                    cursor:"pointer",
                  }}>
                  
                  <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px" }}>
                    <div className={`check-ring${done?" done":""}`} style={{ borderColor:done?habit.color:undefined, background:done?habit.color:undefined, flexShrink:0 }}>
                      {done && <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4L4.5 7.5L11 1" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:16 }}>{habit.emoji}</span>
                        <span style={{ fontSize:15, fontWeight:600, textDecoration:done?"line-through":"none", color:done?"var(--text-secondary)":"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{habit.title}</span>
                      </div>
                      {streak > 0 && <p style={{ margin:"3px 0 0", fontSize:11, color:"var(--text-tertiary)" }}>🔥 {streak} day streak</p>}
                    </div>
                    {!isScheduledToday && <span style={{ fontSize:10, color:"var(--text-tertiary)", fontWeight:600, marginRight:4, padding:"2px 6px", borderRadius:4, background:"var(--surface-3)" }}>Not Today</span>}
                    <button onClick={(e) => openEdit(habit, e)}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"var(--text-tertiary)", borderRadius:8, flexShrink:0 }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={async(e)=>{e.stopPropagation(); deleteHabit(habit.id);}}
                      style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"var(--text-tertiary)", borderRadius:8, flexShrink:0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Habit Dot Matrix (Footer) */}
                  {viewMode === "weekly" ? (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px 14px", gap:4 }}>
                      {last7.map((date) => {
                        const dObj = new Date(date);
                        const dayKey = DAYS[dObj.getDay() === 0 ? 6 : dObj.getDay()-1];
                        const createdDateStr = format(new Date(habit.createdAt), "yyyy-MM-dd");
                        const isBeforeCreation = date < createdDateStr;
                        const scheduled = Array.isArray(habit.frequency) && habit.frequency.includes(dayKey) && !isBeforeCreation;
                        const logged = logMap[date];
                        const isPast = date < today;
                        const missed = scheduled && !logged && isPast && date >= accountStart;
                        return (
                          <div key={date} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                            <div style={{ 
                              width:24, height:24, borderRadius:"50%", 
                              background: logged ? habit.color : missed ? "#EF444415" : scheduled ? `${habit.color}25` : "var(--surface-3)", 
                              border: missed ? "1px solid #EF4444" : scheduled && !logged ? `1px solid ${habit.color}50` : "none", 
                              boxShadow: missed ? "0 0 8px #EF444440" : "none",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition:"all 0.2s ease" 
                            }}>
                              {missed && <span style={{ color: "#EF4444", fontSize: 16, fontWeight: 700, lineHeight: 1, marginTop: -1 }}>×</span>}
                            </div>
                            <span style={{ fontSize:9, color:"var(--text-tertiary)", fontWeight:600 }}>{["M","T","W","T","F","S","S"][dObj.getDay()===0?6:dObj.getDay()-1]}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding:"0 16px 14px" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:6, marginBottom: 8 }}>
                        {DAY_LABELS.map((l, i) => (
                          <div key={i} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"var(--text-tertiary)" }}>{l}</div>
                        ))}
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:6 }}>
                        {last28.map((date) => {
                          const dObj = new Date(date);
                          const dayKey = DAYS[dObj.getDay() === 0 ? 6 : dObj.getDay()-1];
                          const createdDateStr = format(new Date(habit.createdAt), "yyyy-MM-dd");
                          const isBeforeCreation = date < createdDateStr;
                          const scheduled = Array.isArray(habit.frequency) && habit.frequency.includes(dayKey) && !isBeforeCreation;
                          const logged = logMap[date];
                          const isPast = date < today;
                          const missed = scheduled && !logged && isPast && date >= accountStart;
                          return (
                            <div key={date} style={{ display:"flex", justifyContent:"center" }}>
                              <div style={{ 
                                width:16, height:16, borderRadius:4, 
                                background: logged ? habit.color : missed ? "#EF444415" : scheduled ? `${habit.color}25` : "var(--surface-3)", 
                                border: missed ? "1px solid #EF4444" : scheduled && !logged ? `1px solid ${habit.color}50` : !scheduled ? "1px solid var(--border)" : "none", 
                                boxShadow: missed ? "0 0 6px #EF444440" : "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition:"all 0.2s ease",
                                opacity: scheduled ? 1 : 0.4
                              }}>
                                {missed && <span style={{ color: "#EF4444", fontSize: 13, fontWeight: 800, lineHeight: 1, marginTop: -1 }}>×</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {(!habits || habits.length === 0) && (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔥</div>
          <p style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>No habits yet</p>
          <p style={{ color:"var(--text-secondary)", fontSize:14 }}>Start building your system. Tap + to add your first habit.</p>
        </div>
      )}

      {/* ======== ADD HABIT SHEET ======== */}
      <BottomSheet open={addOpen} onClose={()=>{setAddOpen(false);setEmojiOpen(false);}} title="New Habit">
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Emoji picker — tap to expand */}
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:8 }}>Icon</label>
            <button onClick={()=>setEmojiOpen(!emojiOpen)} className="tap-scale"
              style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:16, background:"var(--surface-3)", border:"1px solid var(--border)", cursor:"pointer", width:"100%" }}>
              <div style={{ width:44, height:44, borderRadius:14, background:"var(--surface-2)", border:"2px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                {form.emoji}
              </div>
              <span style={{ fontSize:13, color:"var(--text-secondary)", flex:1, textAlign:"left" }}>Tap to pick an icon</span>
              {emojiOpen ? <ChevronUp size={16} style={{color:"var(--text-tertiary)"}} /> : <ChevronDown size={16} style={{color:"var(--text-tertiary)"}} />}
            </button>
            {emojiOpen && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap:6, marginTop:10, maxHeight:200, overflowY:"auto", padding:"4px 2px" }}>
                {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => { setForm(f => ({...f, emoji: e})); setEmojiOpen(false); }}
                    style={{ fontSize:22, padding:"8px 0", borderRadius:12, border:`2px solid ${form.emoji===e ? "var(--accent)" : "transparent"}`, background: form.emoji===e ? "rgba(110,231,183,0.15)" : "var(--surface-3)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s ease" }}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Habit Name</label>
            <input type="text" className="lock-input" placeholder="e.g. Read Bible" value={form.title}
              onChange={e=>setForm(f=>({...f,title:e.target.value}))}
              onKeyDown={e => e.key==="Enter" && addHabit()} />
          </div>

          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Category</label>
            <select className="lock-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value as Habit["category"]}))}>
              {Object.entries(CATEGORY_CONFIG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:10 }}>Frequency</label>
            <div style={{ display:"flex", gap:6 }}>
              {DAYS.map((day,i) => (
                <button key={day} onClick={()=>toggleFormDay(day)}
                  style={{ flex:1, padding:"10px 0", borderRadius:12, border:`1px solid ${form.frequency.includes(day)?"var(--accent)":"var(--border)"}`, background:form.frequency.includes(day)?"var(--accent)":"var(--surface-3)", color:form.frequency.includes(day)?"#000":"var(--text-secondary)", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                  {DAY_LABELS[i]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:10 }}>Color</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {COLORS.map(c => (
                <button key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                  style={{ width:32, height:32, borderRadius:"50%", background:c, border:`3px solid ${form.color===c?"white":"transparent"}`, cursor:"pointer", transition:"border 0.15s ease" }} />
              ))}
            </div>
          </div>

          <button className="tap-scale" onClick={addHabit}
            style={{ padding:16, borderRadius:16, background:"var(--accent)", border:"none", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%", marginTop:8 }}>
            Create Habit
          </button>
        </div>
      </BottomSheet>

      {/* ======== EDIT HABIT SHEET ======== */}
      <BottomSheet open={!!habitEdit} onClose={()=>{setHabitEdit(null);setEditEmojiOpen(false);}} title={habitEdit ? `Edit: ${habitEdit.title}` : ""}>
        {habitEdit && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Emoji picker */}
            <div>
              <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:8 }}>Icon</label>
              <button onClick={()=>setEditEmojiOpen(!editEmojiOpen)} className="tap-scale"
                style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:16, background:"var(--surface-3)", border:"1px solid var(--border)", cursor:"pointer", width:"100%" }}>
                <div style={{ width:44, height:44, borderRadius:14, background:"var(--surface-2)", border:"2px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                  {habitEdit.emoji}
                </div>
                <span style={{ fontSize:13, color:"var(--text-secondary)", flex:1, textAlign:"left" }}>Tap to change icon</span>
                {editEmojiOpen ? <ChevronUp size={16} style={{color:"var(--text-tertiary)"}} /> : <ChevronDown size={16} style={{color:"var(--text-tertiary)"}} />}
              </button>
              {editEmojiOpen && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap:6, marginTop:10, maxHeight:200, overflowY:"auto", padding:"4px 2px" }}>
                  {EMOJI_LIST.map(e => (
                    <button key={e} onClick={() => { setHabitEdit((f) => (f ? { ...f, emoji: e } : f)); setEditEmojiOpen(false); }}
                      style={{ fontSize:22, padding:"8px 0", borderRadius:12, border:`2px solid ${habitEdit.emoji===e ? "var(--accent)" : "transparent"}`, background: habitEdit.emoji===e ? "rgba(110,231,183,0.15)" : "var(--surface-3)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s ease" }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Frequency */}
            <div>
              <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:10 }}>Active Days</label>
              <div style={{ display:"flex", gap:6 }}>
                {DAYS.map((day,i) => (
                  <button key={day} onClick={()=>toggleEditDay(day)}
                    style={{ flex:1, padding:"10px 0", borderRadius:12, border:`1px solid ${habitEdit.frequency.includes(day)?"var(--accent)":"var(--border)"}`, background:habitEdit.frequency.includes(day)?"var(--accent)":"var(--surface-3)", color:habitEdit.frequency.includes(day)?"#000":"var(--text-secondary)", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                    {DAY_LABELS[i]}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:10 }}>Color</label>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {COLORS.map(c => (
                  <button key={c} onClick={()=>setHabitEdit(f=>(f?{...f,color:c}:f))}
                    style={{ width:32, height:32, borderRadius:"50%", background:c, border:`3px solid ${habitEdit.color===c?"white":"transparent"}`, cursor:"pointer", transition:"border 0.15s ease" }} />
                ))}
              </div>
            </div>

            <button className="tap-scale" onClick={saveEdit}
              style={{ padding:16, borderRadius:16, background:"var(--accent)", border:"none", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%", marginTop:8 }}>
              Save Changes
            </button>

            <button className="tap-scale" onClick={()=>{deleteHabit(habitEdit.id); setHabitEdit(null);}}
              style={{ padding:14, borderRadius:14, background:"#EF444412", border:"1px solid #EF444425", color:"#EF4444", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Trash2 size={15} /> Delete Habit
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
