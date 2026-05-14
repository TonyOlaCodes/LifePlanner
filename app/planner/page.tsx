"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, getTodayString, type Task } from "@/lib/db";
import { vibrate } from "@/lib/utils";
import BottomSheet from "@/components/ui/BottomSheet";
import { Plus, CheckCircle2, Circle, Trash2, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isSameMonth, getDay } from "date-fns";

const PRIORITIES = ["high","medium","low"] as const;
const P_COLOR: Record<string,string> = { high:"#EF4444", medium:"#F59E0B", low:"#10B981" };
const CAT_COLOR: Record<string,string> = { study:"#10B981", coding:"#8B5CF6", exam:"#3B82F6", gym:"#EF4444", faith:"#F59E0B", personal:"#EC4899", work:"#06B6D4", other:"#F97316" };
const CATEGORIES = [
  { value:"study",    label:"📚 Study" },
  { value:"coding",   label:"💻 Coding" },
  { value:"exam",     label:"📝 Exam" },
  { value:"gym",      label:"💪 Gym" },
  { value:"faith",    label:"🙏 Faith" },
  { value:"personal", label:"⭐ Personal" },
  { value:"work",     label:"💼 Work" },
  { value:"other",    label:"📌 Other" },
];
const WEEKDAY_HEADERS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

type ViewMode = "week" | "month";

export default function PlannerPage() {
  const today = getTodayString();
  const todayDate = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekAnchor, setWeekAnchor] = useState(startOfWeek(todayDate, { weekStartsOn: 1 }));
  const [monthAnchor, setMonthAnchor] = useState(startOfMonth(todayDate));
  const [addOpen, setAddOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title:"", category:"study", priority:"medium" as typeof PRIORITIES[number], dueDate: today, recurrence: "none" as "none"|"daily"|"weekly"|"monthly" });

  const tasks = useLiveQuery(() => db.tasks.toArray(), []);

  // Build date lists
  const weekDays = Array.from({ length:7 }, (_,i) => addDays(weekAnchor, i));

  // Month calendar grid (pad to start on Monday)
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const totalCells = 42; // 6 rows × 7 cols
  const monthDays = Array.from({ length: totalCells }, (_,i) => addDays(monthGridStart, i));

  // Task lookup by date string
  const tasksByDate = (tasks || []).reduce<Record<string, typeof tasks>>((acc, t) => {
    if (t.dueDate) {
      if (!acc[t.dueDate]) acc[t.dueDate] = [];
      acc[t.dueDate]!.push(t);
    }
    return acc;
  }, {});

  // Tasks for selected day
  const rawDayTasks = tasksByDate[selectedDate] || [];
  const dayTasks = [
    ...rawDayTasks.filter(t => !t.completed).sort((a,b) => {
      const po: Record<string,number> = { high:0, medium:1, low:2 };
      return (po[a.priority]??1) - (po[b.priority]??1);
    }),
    ...rawDayTasks.filter(t => t.completed),
  ];

  const noDueTasks = (tasks||[]).filter(t => !t.dueDate && !t.completed);
  const pendingCount = (tasks||[]).filter(t => !t.completed).length;

  async function addTask() {
    vibrate(50);
    if (!taskForm.title.trim()) return;
    await db.tasks.put({
      id: crypto.randomUUID(), title: taskForm.title.trim(), category: taskForm.category,
      completed: false, priority: taskForm.priority, dueDate: taskForm.dueDate, createdAt: Date.now(),
      recurrence: taskForm.recurrence
    });
    setTaskForm({ title:"", category:"study", priority:"medium", dueDate: selectedDate, recurrence: "none" });
    setAddOpen(false);
  }

  async function toggleTask(task: Task) {
    vibrate(40);
    if (!task.completed && task.recurrence && task.recurrence !== "none" && task.dueDate) {
      // It's being checked, and it's recurring. Spawn the next one.
      let nextDate = parseISO(task.dueDate);
      if (task.recurrence === "daily") nextDate = addDays(nextDate, 1);
      if (task.recurrence === "weekly") nextDate = addWeeks(nextDate, 1);
      if (task.recurrence === "monthly") nextDate = addMonths(nextDate, 1);
      
      await db.tasks.put({
        id: crypto.randomUUID(), title: task.title, category: task.category,
        completed: false, priority: task.priority, dueDate: format(nextDate, "yyyy-MM-dd"), createdAt: Date.now(),
        recurrence: task.recurrence
      });
      // Complete current task and remove its recurrence so it doesn't double-spawn if toggled again
      await db.tasks.update(task.id, { completed: true, recurrence: "none" });
    } else {
      await db.tasks.update(task.id, { completed: !task.completed });
    }
  }

  async function deleteTask(id: string) {
    vibrate([20,20,20]);
    await db.tasks.delete(id);
  }

  const CAT_LABEL: Record<string,string> = Object.fromEntries(CATEGORIES.map(c=>[c.value, c.label]));

  return (
    <div style={{ padding:"0 16px", paddingTop:16 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:-0.5, margin:0 }}>Tasks 📋</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:13, margin:"4px 0 0" }}>{pendingCount} pending tasks</p>
        </div>
        <button className="tap-scale" onClick={() => { setTaskForm(f=>({...f, dueDate:selectedDate})); setAddOpen(true); }}
          style={{ width:44, height:44, borderRadius:14, background:"var(--accent)", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <Plus size={22} style={{color:"#000"}} />
        </button>
      </div>

      {/* View toggle */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {(["week","month"] as ViewMode[]).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} className="tap-scale"
            style={{ flex:1, padding:"10px 0", borderRadius:14, border:`1px solid ${viewMode===mode?"var(--accent)":"var(--border)"}`, background:viewMode===mode?"var(--accent)":"var(--surface-2)", color:viewMode===mode?"#000":"var(--text-secondary)", fontWeight:700, fontSize:13, cursor:"pointer", textTransform:"capitalize" }}>
            {mode}
          </button>
        ))}
      </div>

      {/* ========== WEEK VIEW ========== */}
      {viewMode === "week" && (
        <>
          {/* Week nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <button className="tap-scale" onClick={() => setWeekAnchor(subWeeks(weekAnchor, 1))}
              style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"var(--text-secondary)" }}>
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize:13, fontWeight:700, color:"var(--text-secondary)" }}>
              {format(weekDays[0],"MMM d")} – {format(weekDays[6],"MMM d, yyyy")}
            </span>
            <button className="tap-scale" onClick={() => setWeekAnchor(addWeeks(weekAnchor, 1))}
              style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"var(--text-secondary)" }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Week pills */}
          <div style={{ display:"flex", gap:6, marginBottom:24, overflowX:"auto", paddingBottom:4 }}>
            {weekDays.map(day => {
              const ds = format(day, "yyyy-MM-dd");
              const isSelected = ds === selectedDate;
              const isToday = ds === today;
              const dayTaskList = tasksByDate[ds] || [];
              const hasIncomplete = dayTaskList.some(t => !t.completed);
              const hasAny = dayTaskList.length > 0;
              // Collect unique category colors for dots
              const dotColors = [...new Set(dayTaskList.map(t => CAT_COLOR[t.category] || "var(--accent)"))].slice(0,3);
              return (
                <button key={ds} onClick={() => setSelectedDate(ds)} className="tap-scale"
                  style={{ minWidth:50, padding:"10px 8px", borderRadius:16, background:isSelected?"var(--accent)":isToday?"var(--surface-3)":"var(--surface-2)", border:`1px solid ${isSelected?"var(--accent)":isToday?"var(--border-strong)":"var(--border)"}`, display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", flexShrink:0 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:isSelected?"#000":isToday?"var(--text-primary)":"var(--text-secondary)" }}>{format(day,"EEE")}</span>
                  <span style={{ fontSize:18, fontWeight:800, color:isSelected?"#000":isToday?"var(--accent)":"var(--text-primary)" }}>{format(day,"d")}</span>
                  {hasAny && (
                    <div style={{ display:"flex", gap:3 }}>
                      {dotColors.map((c,i) => (
                        <div key={i} style={{ width:5, height:5, borderRadius:"50%", background: isSelected ? "#00000060" : c }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ========== MONTH VIEW ========== */}
      {viewMode === "month" && (
        <>
          {/* Month nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <button className="tap-scale" onClick={() => setMonthAnchor(subMonths(monthAnchor, 1))}
              style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"var(--text-secondary)" }}>
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)" }}>
              {format(monthAnchor, "MMMM yyyy")}
            </span>
            <button className="tap-scale" onClick={() => setMonthAnchor(addMonths(monthAnchor, 1))}
              style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"var(--text-secondary)" }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:2, marginBottom:4 }}>
            {WEEKDAY_HEADERS.map(h => (
              <div key={h} style={{ textAlign:"center", fontSize:11, fontWeight:700, color:"var(--text-tertiary)", padding:"4px 0" }}>{h}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:3, marginBottom:20 }}>
            {monthDays.map(day => {
              const ds = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, monthAnchor);
              const isSelected = ds === selectedDate;
              const isToday = ds === today;
              const dayTaskList = tasksByDate[ds] || [];
              const dotColors = [...new Set(dayTaskList.map(t => CAT_COLOR[t.category] || "var(--accent)"))].slice(0,3);

              return (
                <button key={ds} onClick={() => setSelectedDate(ds)} className="tap-scale"
                  style={{
                    padding:"8px 2px 6px", borderRadius:12, cursor:"pointer", border:"none",
                    background: isSelected ? "var(--accent)" : isToday ? "var(--surface-3)" : "transparent",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                    opacity: inMonth ? 1 : 0.25, transition:"all 0.15s ease",
                    outline: isToday && !isSelected ? "1px solid var(--accent)" : "none",
                  }}>
                  <span style={{ fontSize:13, fontWeight: isToday || isSelected ? 800 : 500, color: isSelected ? "#000" : isToday ? "var(--accent)" : "var(--text-primary)" }}>
                    {format(day, "d")}
                  </span>
                  {/* Category dots */}
                  <div style={{ display:"flex", gap:2, minHeight:6 }}>
                    {dotColors.map((c,i) => (
                      <div key={i} style={{ width:5, height:5, borderRadius:"50%", background: isSelected ? "#00000050" : c }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ========== SELECTED DAY TASKS ========== */}
      <section style={{ marginBottom:32 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <h2 style={{ fontSize:15, fontWeight:700, margin:0, color:"var(--text-secondary)" }}>
            {format(parseISO(selectedDate), "EEEE, MMMM d")}
          </h2>
          <span style={{ fontSize:12, color:"var(--text-tertiary)" }}>
            {dayTasks.filter(t=>t.completed).length}/{dayTasks.length} done
          </span>
        </div>

        {dayTasks.length === 0 ? (
          <div style={{ padding:"32px 20px", textAlign:"center", borderRadius:20, background:"var(--surface-2)", border:"1px dashed var(--border)" }}>
            <CalendarDays size={28} style={{color:"var(--text-tertiary)", margin:"0 auto 12px"}} />
            <p style={{ color:"var(--text-tertiary)", fontSize:14, margin:0 }}>No tasks for this day</p>
            <button onClick={() => { setTaskForm(f=>({...f,dueDate:selectedDate})); setAddOpen(true); }}
              style={{ marginTop:12, padding:"10px 20px", borderRadius:12, background:"var(--accent)", border:"none", color:"#000", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Add Task
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {dayTasks.map(task => (
              <div key={task.id}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:18,
                  background: task.completed ? "var(--surface-2)" : `${P_COLOR[task.priority]}08`,
                  border:`1px solid ${task.completed ? "var(--border)" : P_COLOR[task.priority]+"30"}`,
                  opacity: task.completed ? 0.55 : 1, transition:"all 0.25s ease" }}>
                <button className="tap-scale" onClick={() => toggleTask(task)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:0, color: task.completed ? "var(--accent)" : "var(--text-tertiary)", flexShrink:0 }}>
                  {task.completed ? <CheckCircle2 size={22} style={{color:"var(--accent)"}} /> : <Circle size={22} style={{color:P_COLOR[task.priority]}} />}
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:600, textDecoration:task.completed?"line-through":"none", color:task.completed?"var(--text-tertiary)":"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                    <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>{CAT_LABEL[task.category] || task.category}</span>
                    <span style={{ fontSize:10, color:P_COLOR[task.priority], fontWeight:700, textTransform:"uppercase" }}>{task.priority}</span>
                  </div>
                </div>
                <button onClick={() => deleteTask(task.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"var(--text-tertiary)", borderRadius:8, flexShrink:0 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inbox */}
      {noDueTasks.length > 0 && (
        <section style={{ marginBottom:32 }}>
          <h2 style={{ fontSize:15, fontWeight:700, margin:"0 0 12px", color:"var(--text-secondary)" }}>Inbox (no date)</h2>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {noDueTasks.map(task => (
              <div key={task.id}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderRadius:16, background:"var(--surface-2)", border:"1px solid var(--border)" }}>
                <button className="tap-scale" onClick={() => toggleTask(task)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:0, color:"var(--text-tertiary)", flexShrink:0 }}>
                  <Circle size={20} />
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</p>
                  <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>{CAT_LABEL[task.category] || task.category}</span>
                </div>
                <button onClick={() => deleteTask(task.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:6, color:"var(--text-tertiary)", borderRadius:8 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add Task Sheet */}
      <BottomSheet open={addOpen} onClose={()=>setAddOpen(false)} title="Add Task">
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Task</label>
            <input type="text" className="lock-input" placeholder="What needs to be done?" value={taskForm.title}
              onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))}
              onKeyDown={e => e.key === "Enter" && addTask()} />
          </div>
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Category</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setTaskForm(f=>({...f,category:c.value}))}
                  style={{ padding:"8px 12px", borderRadius:12, border:`1px solid ${taskForm.category===c.value?"var(--accent)":"var(--border)"}`, background:taskForm.category===c.value?"var(--accent)":"var(--surface-3)", color:taskForm.category===c.value?"#000":"var(--text-secondary)", fontWeight:600, fontSize:12, cursor:"pointer" }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Due Date</label>
            <input type="date" className="lock-input" value={taskForm.dueDate}
              onChange={e=>setTaskForm(f=>({...f,dueDate:e.target.value}))} />
          </div>
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Priority</label>
            <div style={{ display:"flex", gap:8 }}>
              {PRIORITIES.map(p=>(
                <button key={p} onClick={()=>setTaskForm(f=>({...f,priority:p}))}
                  style={{ flex:1, padding:"10px 4px", borderRadius:12, border:`1px solid ${taskForm.priority===p?P_COLOR[p]:"var(--border)"}`, background:taskForm.priority===p?`${P_COLOR[p]}20`:"var(--surface-3)", color:taskForm.priority===p?P_COLOR[p]:"var(--text-secondary)", fontWeight:700, fontSize:13, cursor:"pointer", textTransform:"capitalize" }}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:13, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>Repeat</label>
            <div style={{ display:"flex", gap:8 }}>
              {(["none", "daily", "weekly", "monthly"] as const).map(r => (
                <button key={r} onClick={()=>setTaskForm(f=>({...f, recurrence:r}))}
                  style={{ flex:1, padding:"10px 4px", borderRadius:12, border:`1px solid ${taskForm.recurrence===r?"var(--accent)":"var(--border)"}`, background:taskForm.recurrence===r?"var(--accent)":"var(--surface-3)", color:taskForm.recurrence===r?"#000":"var(--text-secondary)", fontWeight:600, fontSize:13, cursor:"pointer", textTransform:"capitalize" }}>{r}</button>
              ))}
            </div>
          </div>
          <button className="tap-scale" onClick={addTask}
            style={{ padding:16, borderRadius:16, background:"var(--accent)", border:"none", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%", marginTop:8 }}>
            Add Task
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
