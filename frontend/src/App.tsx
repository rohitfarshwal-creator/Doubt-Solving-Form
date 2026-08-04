import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { create } from 'zustand';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { 
  GraduationCap, Save, Sparkles, Building2, Calendar, CheckCircle2, 
  ArrowLeft, FileText, Users, Plus, Trash2, Palmtree, LayoutDashboard, Clock, LogOut, Check, X
} from 'lucide-react';
import { Card, Label, Input, Select, Button, GlobalLoader, MultiSelect, ErrorBanner } from './components';

const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 });
const queryClient = new QueryClient();

// ==========================================
// ZUSTAND GLOBAL STATE
// ==========================================
interface UserData { username: string; role: 'Faculty' | 'HR' | 'Admin'; }

interface SessionStore {
  currentView: 'home' | 'session' | 'dpp' | 'leave' | 'dashboard';
  currentUser: UserData | null;
  cohort: string;
  centre: string;
  sessionType: string;
  selectedBatches: Set<string>;
  selectedStudents: Map<string, any>;
  setCurrentView: (v: 'home' | 'session' | 'dpp' | 'leave' | 'dashboard') => void;
  setCurrentUser: (user: UserData | null) => void;
  setCohort: (c: string) => void;
  setCentre: (c: string) => void;
  setSessionType: (t: string) => void;
  toggleBatch: (b: string) => void;
  selectAllBatches: (b: string[]) => void;
  clearAllBatches: () => void;
  toggleStudent: (s: any) => void;
  selectAllStudents: (s: any[]) => void;
  clearAllStudents: () => void;
  resetFormState: () => void;
}

const useSessionStore = create<SessionStore>((set) => ({
  currentView: 'home', currentUser: null, cohort: '', centre: '', sessionType: '', selectedBatches: new Set<string>(), selectedStudents: new Map<string, any>(),
  setCurrentView: (view) => set({ currentView: view }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setCohort: (cohort) => set({ cohort, centre: '', selectedBatches: new Set(), selectedStudents: new Map() }),
  setCentre: (centre) => set({ centre, selectedBatches: new Set(), selectedStudents: new Map() }),
  setSessionType: (sessionType) => set({ sessionType, selectedStudents: new Map() }),
  toggleBatch: (batch) => set((state) => {
    const b = new Set(state.selectedBatches); b.has(batch) ? b.delete(batch) : b.add(batch);
    const s = new Map(state.selectedStudents); for (const [name, stu] of s.entries()) if (!b.has(stu.batch)) s.delete(name);
    return { selectedBatches: b, selectedStudents: s };
  }),
  selectAllBatches: (batches) => set({ selectedBatches: new Set(batches) }),
  clearAllBatches: () => set({ selectedBatches: new Set(), selectedStudents: new Map() }),
  toggleStudent: (student) => set((state) => {
    const s = new Map(state.selectedStudents); s.has(student.name) ? s.delete(student.name) : s.set(student.name, student);
    return { selectedStudents: s };
  }),
  selectAllStudents: (students) => { const s = new Map<string, any>(); students.forEach(stu => s.set(stu.name, stu)); set({ selectedStudents: s }); },
  clearAllStudents: () => set({ selectedStudents: new Map() }),
  resetFormState: () => set({ cohort: '', centre: '', sessionType: '', selectedBatches: new Set(), selectedStudents: new Map() })
}));


// ==========================================
// HOME DASHBOARD VIEW
// ==========================================
function HomeDashboard() {
  const setView = useSessionStore(state => state.setCurrentView);
  const resetFormState = useSessionStore(state => state.resetFormState);
  const navigateTo = (view: 'session' | 'dpp' | 'leave' | 'dashboard') => { resetFormState(); setView(view); };

  return (
    <div className="max-w-5xl mx-auto w-full animate-fade-in py-12">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl shadow-blue-500/30 mb-6">
          <GraduationCap className="w-12 h-12 text-white stroke-[2]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">PW Gulf Faculty Portal</h1>
        <p className="text-slate-500 text-lg font-medium">Select a module to log your session, submit materials, or manage leaves.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-6">
        <button onClick={() => navigateTo('session')} className="group text-left p-8 rounded-3xl bg-white border border-slate-200 shadow-lg hover:shadow-2xl hover:border-blue-400 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Users className="w-32 h-32 text-blue-600" /></div>
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6"><Users className="w-7 h-7 text-blue-600" /></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Extra Class Session</h2>
          <p className="text-slate-500 font-medium">Log 1:1, SGC, or LGC doubt classes and track student attendance.</p>
        </button>

        <button onClick={() => navigateTo('dpp')} className="group text-left p-8 rounded-3xl bg-white border border-slate-200 shadow-lg hover:shadow-2xl hover:border-indigo-400 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><FileText className="w-32 h-32 text-indigo-600" /></div>
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6"><FileText className="w-7 h-7 text-indigo-600" /></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">DPP Form</h2>
          <p className="text-slate-500 font-medium">Submit daily practice problems, homework topics, and batch attachments.</p>
        </button>

        <button onClick={() => navigateTo('leave')} className="group text-left p-8 rounded-3xl bg-white border border-slate-200 shadow-lg hover:shadow-2xl hover:border-emerald-400 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Palmtree className="w-32 h-32 text-emerald-600" /></div>
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6"><Palmtree className="w-7 h-7 text-emerald-600" /></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Faculty Leave Form</h2>
          <p className="text-slate-500 font-medium">Request time off, sick leaves, and alert your cluster heads.</p>
        </button>

        <button onClick={() => navigateTo('dashboard')} className="group text-left p-8 rounded-3xl bg-white border border-slate-200 shadow-lg hover:shadow-2xl hover:border-slate-800 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><LayoutDashboard className="w-32 h-32 text-slate-800" /></div>
          <div className="w-14 h-14 bg-slate-200 rounded-2xl flex items-center justify-center mb-6"><LayoutDashboard className="w-7 h-7 text-slate-800" /></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Leave Dashboard</h2>
          <p className="text-slate-500 font-medium">Login to view all leave requests, track approvals, and manage workflow.</p>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 1. EXTRA CLASS SESSION FORM (Unchanged)
// ==========================================
function ExtraClassForm({ initData, isLoading, mutation }: any) {
  const store = useSessionStore();
  const setView = useSessionStore(state => state.setCurrentView);
  const { register, handleSubmit, reset } = useForm<any>({ defaultValues: { date: new Date().toISOString().split('T')[0] } });

  const reqCentre = store.cohort === 'Qatar Offline';
  const teachers = useMemo(() => { if (!initData?.teachers || !store.cohort) return []; return Array.from(new Set<string>(initData.teachers.filter((t: any) => t.cohort === store.cohort).map((t: any) => t.name))).sort(); }, [initData, store.cohort]);
  const centres = useMemo(() => { if (!initData?.students || !store.cohort) return []; return Array.from(new Set<string>(initData.students.filter((s: any) => s.cohort === store.cohort && s.branch).map((s: any) => s.branch))).sort(); }, [initData, store.cohort]);
  const batches = useMemo(() => { if (!initData?.students || !store.cohort) return []; let f = initData.students.filter((s: any) => s.cohort === store.cohort); if (reqCentre && store.centre) f = f.filter((s: any) => s.branch === store.centre); return Array.from(new Set<string>(f.map((s: any) => s.batch).filter(Boolean))).sort(); }, [initData, store.cohort, store.centre, reqCentre]);
  const students = useMemo(() => { if (!initData?.students || store.selectedBatches.size === 0) return []; const bArr = Array.from(store.selectedBatches); let f = initData.students.filter((s: any) => s.cohort === store.cohort && bArr.includes(s.batch)); if (reqCentre && store.centre) f = f.filter((s: any) => s.branch === store.centre); const unique = new Map<string, any>(); f.forEach((s: any) => unique.set(s.name, s)); return Array.from(unique.values()).sort((a: any, b: any) => a.name.localeCompare(b.name)); }, [initData, store.cohort, store.selectedBatches, store.centre, reqCentre]);

  const onSubmit = (data: any) => {
    if (!store.cohort || !store.sessionType || store.selectedBatches.size === 0) return toast.error('Please fill required fields.');
    const teacherEl = document.getElementById('teacher') as HTMLSelectElement;
    if (!teacherEl || !teacherEl.value) return toast.error('Please select a Teacher.');
    let finalStudents: any[] = [];
    if (store.sessionType === '1:1') {
      const el = document.getElementById('singleStudent') as HTMLSelectElement; if (!el || !el.value) return toast.error('Please select a Student.'); finalStudents.push(JSON.parse(el.value));
    } else {
      if (store.selectedStudents.size === 0) return toast.error('Please select at least one Student.'); finalStudents = Array.from(store.selectedStudents.values());
    }
    mutation.mutate({ endpoint: '/session', payload: { ...data, cohort: store.cohort, branch: reqCentre ? store.centre : '', teacher: teacherEl.value, sessionType: store.sessionType, batchesList: Array.from(store.selectedBatches).join(', '), selectedStudentsData: finalStudents, studentsList: finalStudents.map(s => s.name).join(', ') } }, { onSuccess: () => { reset({ date: new Date().toISOString().split('T')[0], subject: '', topic: '', duration: '', notes: '' }); store.resetFormState(); if (teacherEl) teacherEl.value = ''; } });
  };

  return (
    <div className="animate-fade-in">
      <header className="mb-10"><button onClick={() => setView('home')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 text-sm font-bold mb-6"><ArrowLeft className="w-4 h-4"/> Back to Dashboard</button><h1 className="text-3xl font-black">Log Extra Class Session</h1></header>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5 bg-slate-50/70 border border-slate-100 rounded-xl">
            <div><Label required>Cohort</Label><Select value={store.cohort} onChange={(e:any) => store.setCohort(e.target.value)} required><option value="" disabled>Select...</option>{initData?.cohorts?.map((c: string) => <option key={c} value={c}>{c}</option>)}</Select></div>
            <div><Label required>Teacher</Label><Select id="teacher" disabled={!store.cohort} defaultValue="" required><option value="" disabled>Select...</option>{teachers.map((t: string) => <option key={t} value={t}>{t}</option>)}</Select></div>
          </div>
          {reqCentre && <div className="p-5 bg-blue-50/50 rounded-xl"><Label required>Centre Name</Label><Select value={store.centre} onChange={(e:any) => store.setCentre(e.target.value)} required><option value="" disabled>Select Centre...</option>{centres.map((c: string) => <option key={c} value={c}>{c}</option>)}</Select></div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div><Label required>Date</Label><Input type="date" {...register('date')} required /></div>
            <div><Label required>Session Type</Label><Select value={store.sessionType} onChange={(e:any) => store.setSessionType(e.target.value)} required><option value="" disabled>Select...</option><option value="1:1">1:1</option><option value="SGC">SGC</option><option value="LGC">LGC</option></Select></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div><Label required>Batches</Label><MultiSelect items={batches} selectedItems={store.selectedBatches} itemKey={(b:string)=>b} renderItem={(b:string)=><span className="font-bold">{b}</span>} onToggle={store.toggleBatch} onSelectAll={()=>store.selectAllBatches(batches)} onClearAll={store.clearAllBatches} placeholder="Search batches..." disabled={batches.length===0} /></div>
            <div><Label required>Subject</Label><Select {...register('subject')} defaultValue="" required><option value="" disabled>Select...</option><option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Maths">Maths</option><option value="Biology">Biology</option><option value="Social Science">Social Science</option><option value="Science(Combined)">Science(Combined)</option></Select></div>
          </div>
          {store.sessionType === '1:1' && <div className="p-5 bg-indigo-50/40 rounded-xl"><Label required>Select Student</Label><Select id="singleStudent" defaultValue="" required><option value="" disabled>Select Student...</option>{students.map((s:any) => <option key={s.name} value={JSON.stringify(s)}>{s.name} ({s.batch})</option>)}</Select></div>}
          {(store.sessionType === 'SGC' || store.sessionType === 'LGC') && <div className="p-5 bg-indigo-50/40 rounded-xl"><Label required>Select Students</Label><MultiSelect items={students} selectedItems={store.selectedStudents} itemKey={(s:any)=>s.name} renderItem={(s:any)=>(<div><span className="font-bold">{s.name}</span> <span className="text-xs text-slate-500">({s.batch})</span></div>)} onToggle={store.toggleStudent} onSelectAll={()=>store.selectAllStudents(students)} onClearAll={store.clearAllStudents} placeholder="Search students..." disabled={students.length===0} /></div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div><Label required>Topic</Label><Input {...register('topic')} required /></div>
            <div><Label required>Duration (mins)</Label><Select {...register('duration')} defaultValue="" required><option value="" disabled>Select...</option>{[15,30,45,60,75,90,105,120,135,150,165,180].map(m=><option key={m} value={m}>{m}</option>)}</Select></div>
          </div>
          <div><Label>Notes</Label><textarea {...register('notes')} className="w-full p-4 border rounded-xl" rows={3}/></div>
          <Button type="submit" isLoading={mutation.isPending}>Save Session Record</Button>
        </form>
      </Card>
    </div>
  );
}

// ==========================================
// 2. DPP FORM (Unchanged)
// ==========================================
function DPPForm({ initData, isLoading, mutation }: any) {
  const store = useSessionStore();
  const setView = useSessionStore(state => state.setCurrentView);
  const { register, control, handleSubmit, reset, setValue } = useForm<any>({ defaultValues: { entries: [{ date: new Date().toISOString().split('T')[0], topic: '', notes: '', attachment: null }] } });
  const { fields, append, remove } = useFieldArray({ control, name: "entries" });

  const reqCentre = store.cohort === 'Qatar Offline';
  const teachers = useMemo(() => { if (!initData?.teachers || !store.cohort) return []; return Array.from(new Set<string>(initData.teachers.filter((t: any) => t.cohort === store.cohort).map((t: any) => t.name))).sort(); }, [initData, store.cohort]);
  const centres = useMemo(() => { if (!initData?.students || !store.cohort) return []; return Array.from(new Set<string>(initData.students.filter((s: any) => s.cohort === store.cohort && s.branch).map((s: any) => s.branch))).sort(); }, [initData, store.cohort]);
  const batches = useMemo(() => { if (!initData?.students || !store.cohort) return []; let f = initData.students.filter((s: any) => s.cohort === store.cohort); if (reqCentre && store.centre) f = f.filter((s: any) => s.branch === store.centre); return Array.from(new Set<string>(f.map((s: any) => s.batch).filter(Boolean))).sort(); }, [initData, store.cohort, store.centre, reqCentre]);

  const onSubmit = (data: any) => {
    const teacherEl = document.getElementById('teacherDpp') as HTMLSelectElement;
    if (!store.cohort || !teacherEl?.value || store.selectedBatches.size === 0) return toast.error('Please fill required fields.');
    mutation.mutate({ endpoint: '/dpp', payload: { cohort: store.cohort, branch: reqCentre ? store.centre : '', teacher: teacherEl.value, batchesList: Array.from(store.selectedBatches).join(', '), subject: data.subject, entries: data.entries } }, { onSuccess: () => { reset({ entries: [{ date: new Date().toISOString().split('T')[0], topic: '', notes: '', attachment: null }] }); store.resetFormState(); if (teacherEl) teacherEl.value = ''; const fileInputs = document.querySelectorAll('input[type="file"]'); fileInputs.forEach((input: any) => input.value = ''); } });
  };

  return (
    <div className="animate-fade-in">
      <header className="mb-10"><button onClick={() => setView('home')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 text-sm font-bold mb-6"><ArrowLeft className="w-4 h-4"/> Back to Dashboard</button><h1 className="text-3xl font-black">DPP Form</h1></header>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div><Label required>Cohort</Label><Select value={store.cohort} onChange={(e:any) => store.setCohort(e.target.value)} required><option value="" disabled>Select...</option>{initData?.cohorts?.map((c: string) => <option key={c} value={c}>{c}</option>)}</Select></div>
            <div><Label required>Teacher</Label><Select id="teacherDpp" disabled={!store.cohort} defaultValue="" required><option value="" disabled>Select...</option>{teachers.map((t: string) => <option key={t} value={t}>{t}</option>)}</Select></div>
          </div>
          {reqCentre && <div className="mb-6"><Label required>Centre</Label><Select value={store.centre} onChange={(e:any) => store.setCentre(e.target.value)} required><option value="" disabled>Select...</option>{centres.map((c: string) => <option key={c} value={c}>{c}</option>)}</Select></div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div><Label required>Batches</Label><MultiSelect items={batches} selectedItems={store.selectedBatches} itemKey={(b:string)=>b} renderItem={(b:string)=><span className="font-bold">{b}</span>} onToggle={store.toggleBatch} onSelectAll={()=>store.selectAllBatches(batches)} onClearAll={store.clearAllBatches} placeholder="Search batches..." disabled={batches.length===0} /></div>
            <div><Label required>Subject</Label><Select {...register('subject')} defaultValue="" required><option value="" disabled>Select...</option><option value="Physics">Physics</option><option value="Chemistry">Chemistry</option><option value="Maths">Maths</option><option value="Biology">Biology</option><option value="Social Science">Social Science</option><option value="Science(Combined)">Science(Combined)</option></Select></div>
          </div>
        </Card>
        
        <div className="space-y-6">
          {fields.map((item, index) => (
            <Card key={item.id} className="relative border-l-4 border-l-indigo-500">
              {fields.length > 1 && <button type="button" onClick={() => remove(index)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div><Label required>Date of DPP</Label><Input type="date" {...register(`entries.${index}.date`)} required /></div>
                <div><Label required>Home Work Topic</Label><Input {...register(`entries.${index}.topic`)} required /></div>
              </div>
              <div className="mb-6"><Label>Additional Notes</Label><textarea {...register(`entries.${index}.notes`)} className="w-full p-4 border rounded-xl" rows={2}/></div>
              <div className="p-5 bg-slate-50 border rounded-xl"><Label>Upload File (Max 3MB)</Label>
                <input type="file" className="mt-2 w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-100 file:text-indigo-700"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) { setValue(`entries.${index}.attachment`, null); return; }
                    if (file.size > 3*1024*1024) { toast.error("File is too large!"); e.target.value = ''; setValue(`entries.${index}.attachment`, null); return; }
                    const reader = new FileReader(); reader.onload = () => { setValue(`entries.${index}.attachment`, { name: file.name, type: file.type, data: (reader.result as string).split(',')[1] }); }; reader.readAsDataURL(file);
                  }}/>
              </div>
            </Card>
          ))}
        </div>
        <div className="flex justify-between gap-4">
          <button type="button" onClick={() => append({ date: new Date().toISOString().split('T')[0], topic: '', notes: '', attachment: null })} className="px-6 py-3 border-2 border-dashed text-indigo-700 font-bold rounded-xl w-full">Add Another Day</button>
          <Button type="submit" isLoading={mutation.isPending} className="w-full">Submit All</Button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// 3. FACULTY LEAVE FORM (Unchanged)
// ==========================================
function LeaveForm({ initData, isLoading, mutation }: any) {
  const store = useSessionStore();
  const setView = useSessionStore(state => state.setCurrentView);
  const { register, handleSubmit, watch, reset, setValue } = useForm<any>({ defaultValues: { fromDate: '', toDate: '', days: 0 } });

  const fromD = watch('fromDate'); const toD = watch('toDate');

  useEffect(() => {
    if (fromD && toD) {
      const start = new Date(fromD); const end = new Date(toD);
      if (end >= start) setValue('days', Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      else setValue('days', 0);
    }
  }, [fromD, toD, setValue]);

  const reqClusterHead = store.cohort === 'UAE Offline' || store.cohort === 'Saudi Offline';
  const clusterHeads = store.cohort === 'UAE Offline' ? ['Saqib Nazir', 'Vaibhav Jain', 'Atul kumar Jha', 'Md.Irfanul Haque'] : store.cohort === 'Saudi Offline' ? ['Fahad Jamal', 'Purbayan Paul'] : [];
  const teachers = useMemo(() => { if (!initData?.teachers || !store.cohort) return []; return Array.from(new Set<string>(initData.teachers.filter((t: any) => t.cohort === store.cohort).map((t: any) => t.name))).sort(); }, [initData, store.cohort]);

  const onSubmit = (data: any) => {
    if (data.days <= 0) return toast.error('Invalid Date Range');
    mutation.mutate({ endpoint: '/leave', payload: { ...data, cohort: store.cohort } }, { onSuccess: () => { reset(); store.resetFormState(); setView('dashboard'); } });
  };

  return (
    <div className="animate-fade-in">
      <header className="mb-10"><button onClick={() => setView('home')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 text-sm font-bold mb-6"><ArrowLeft className="w-4 h-4"/> Back to Dashboard</button><h1 className="text-3xl font-black text-emerald-900">Faculty Leave Form</h1></header>
      <Card className="border-emerald-100">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5 bg-emerald-50/40 rounded-xl">
            <div><Label required>Cohort</Label><Select value={store.cohort} onChange={(e:any) => store.setCohort(e.target.value)} required><option value="" disabled>Select...</option>{initData?.cohorts?.map((c: string) => <option key={c} value={c}>{c}</option>)}</Select></div>
            <div><Label required>Teacher Name</Label><Select {...register('teacher')} disabled={!store.cohort} defaultValue="" required><option value="" disabled>Select...</option>{teachers.map((t: string) => <option key={t} value={t}>{t}</option>)}</Select></div>
          </div>
          {reqClusterHead && <div className="p-5 bg-slate-50 rounded-xl"><Label required>Cluster Head</Label><Select {...register('clusterHead')} defaultValue="" required><option value="" disabled>Select Head...</option>{clusterHeads.map(c => <option key={c} value={c}>{c}</option>)}</Select></div>}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div><Label required>Leave From Date</Label><Input type="date" {...register('fromDate')} required /></div>
            <div><Label required>Leave To Date</Label><Input type="date" {...register('toDate')} required /></div>
            <div><Label>No of Days (Calculated)</Label><Input type="number" {...register('days')} disabled className="bg-slate-100 font-bold text-center" /></div>
          </div>
          <div className="grid grid-cols-1 gap-6">
            <div><Label required>Reason For Leave</Label><Select {...register('reason')} defaultValue="" required><option value="" disabled>Select Reason...</option><option value="Sick Leave">Sick Leave</option><option value="Emergency Leave">Emergency Leave</option><option value="Personal Reasons">Personal Reasons</option><option value="Other Reasons">Other Reasons</option></Select></div>
            <div><Label required>Comments</Label><textarea {...register('comments')} className="w-full p-4 border rounded-xl" rows={3} required placeholder="Provide detail..." /></div>
          </div>
          <Button type="submit" isLoading={mutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">Submit Leave Request</Button>
        </form>
      </Card>
    </div>
  );
}

// ==========================================
// 4. CENTRAL LEAVE DASHBOARD (WITH RBAC)
// ==========================================
function LeaveDashboard() {
  const store = useSessionStore();
  const user = store.currentUser;
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Filters State
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');

  const { data: leavesData, isLoading, refetch } = useQuery({ queryKey: ['leaves'], queryFn: async () => { const res = await apiClient.get('/leaves'); return res.data.leaves; }, enabled: !!user, refetchInterval: 10000 });
  const loginMutation = useMutation({ mutationFn: async (payload: any) => await apiClient.post('/login', payload), onSuccess: (res) => { store.setCurrentUser(res.data.user); toast.success(`Welcome, ${res.data.user.role}!`); }, onError: () => toast.error('Invalid Credentials') });
  const updateLeaveMutation = useMutation({ mutationFn: async (payload: any) => await apiClient.post('/leave/update', payload), onSuccess: () => { toast.success('Status Updated!'); refetch(); }, onError: () => toast.error('Update Failed') });

  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); loginMutation.mutate({ username, password }); };

  // Filter Logic (RBAC Enforced)
  const filteredLeaves = useMemo(() => {
    if (!leavesData) return [];
    let filtered = leavesData;

    // Faculty can ONLY see their own leaves
    if (user?.role === 'Faculty') {
      filtered = filtered.filter((l: any) => l.teacher === user.username);
    } else {
      if (filterCohort) filtered = filtered.filter((l: any) => l.cohort === filterCohort);
      if (filterTeacher) filtered = filtered.filter((l: any) => l.teacher === filterTeacher);
    }

    if (filterStartDate) filtered = filtered.filter((l: any) => new Date(l.fromDate) >= new Date(filterStartDate));
    if (filterEndDate) filtered = filtered.filter((l: any) => new Date(l.fromDate) <= new Date(filterEndDate));

    return filtered;
  }, [leavesData, user, filterStartDate, filterEndDate, filterCohort, filterTeacher]);

  const cohortsList = useMemo(() => Array.from(new Set(leavesData?.map((l: any) => l.cohort))).filter(Boolean).sort(), [leavesData]);
  const teachersList = useMemo(() => Array.from(new Set(leavesData?.map((l: any) => l.teacher))).filter(Boolean).sort(), [leavesData]);

  // KPI Calculations
  const totalLeaves = filteredLeaves.length;
  const approvedLeaves = filteredLeaves.filter((l: any) => l.status === 'Approve').length;
  const rejectedLeaves = filteredLeaves.filter((l: any) => l.status === 'Reject').length;

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 animate-fade-in">
        <header className="mb-6"><button onClick={() => store.setCurrentView('home')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 text-sm font-bold mb-6"><ArrowLeft className="w-4 h-4"/> Back to Dashboard</button></header>
        <Card className="p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4"><LayoutDashboard className="w-6 h-6 text-slate-700"/></div>
            <h2 className="text-2xl font-black">Dashboard Login</h2>
            <p className="text-slate-500 text-sm mt-1">Enter your credentials to access records.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div><Label>User Name (Teacher Name)</Label><Input value={username} onChange={e => setUsername(e.target.value)} required placeholder="e.g. Vishal Vaishnav..." /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter password" /></div>
            <Button type="submit" isLoading={loginMutation.isPending} className="w-full mt-4 bg-slate-800 hover:bg-slate-900">Sign In</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <button onClick={() => store.setCurrentView('home')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 text-sm font-bold mb-4"><ArrowLeft className="w-4 h-4"/> Home</button>
          <h1 className="text-3xl font-black">Leave Dashboard</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Logged in as: <strong className="text-slate-800">{user.username}</strong> ({user.role})</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => store.setCurrentView('leave')} className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 font-bold rounded-lg hover:bg-emerald-200"><Plus className="w-4 h-4"/> Apply Leave</button>
          <button onClick={() => store.setCurrentUser(null)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100"><LogOut className="w-4 h-4"/> Logout</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Requests</h3>
          <p className="text-4xl font-black text-blue-600 mt-2">{totalLeaves}</p>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Approved</h3>
          <p className="text-4xl font-black text-emerald-600 mt-2">{approvedLeaves}</p>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Rejected</h3>
          <p className="text-4xl font-black text-red-600 mt-2">{rejectedLeaves}</p>
        </div>
      </div>

      <Card className="mb-8 p-5 bg-slate-50/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Label className="text-xs">From Date</Label><Input type="date" value={filterStartDate} onChange={e=>setFilterStartDate(e.target.value)} className="py-2" /></div>
          <div><Label className="text-xs">To Date</Label><Input type="date" value={filterEndDate} onChange={e=>setFilterEndDate(e.target.value)} className="py-2" /></div>
          
          {(user.role === 'HR' || user.role === 'Admin') && (
            <>
              <div>
                <Label className="text-xs">Filter Cohort</Label>
                <Select value={filterCohort} onChange={(e:any)=>setFilterCohort(e.target.value)} className="py-2"><option value="">All Cohorts</option>{cohortsList.map((c:any) => <option key={c} value={c}>{c}</option>)}</Select>
              </div>
              <div>
                <Label className="text-xs">Filter Faculty</Label>
                <Select value={filterTeacher} onChange={(e:any)=>setFilterTeacher(e.target.value)} className="py-2"><option value="">All Faculties</option>{teachersList.map((t:any) => <option key={t} value={t}>{t}</option>)}</Select>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-10 text-center"><Clock className="w-8 h-8 mx-auto animate-spin text-slate-400 mb-4"/> Loading records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr><th className="px-6 py-4">Timestamp</th><th className="px-6 py-4">Teacher</th><th className="px-6 py-4">Dates</th><th className="px-6 py-4">Days</th><th className="px-6 py-4">Reason & Notes</th><th className="px-6 py-4">Status</th>{user.role === 'HR' && <th className="px-6 py-4 text-right">Actions</th>}</tr>
              </thead>
              <tbody>
                {filteredLeaves.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No records found.</td></tr>}
                {filteredLeaves.map((l: any) => (
                  <tr key={l.id} className="bg-white border-b hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{l.timestamp}</td>
                    <td className="px-6 py-4 font-bold">{l.teacher} <span className="block text-xs font-normal text-slate-400">{l.cohort}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">{l.fromDate} <br/><span className="text-slate-400">to</span> {l.toDate}</td>
                    <td className="px-6 py-4 text-center font-black">{l.days}</td>
                    <td className="px-6 py-4 max-w-xs truncate" title={l.comments}><strong className="block">{l.reason}</strong><span className="text-xs text-slate-500">{l.comments}</span></td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${l.status === 'Approve' ? 'bg-green-100 text-green-800' : l.status === 'Reject' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{l.status}</span>
                    </td>
                    {user.role === 'HR' && (
                      <td className="px-6 py-4 text-right">
                        {l.status === 'Pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => updateLeaveMutation.mutate({ id: l.id, action: 'Approve' })} disabled={updateLeaveMutation.isPending} className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors"><Check className="w-4 h-4"/></button>
                            <button onClick={() => updateLeaveMutation.mutate({ id: l.id, action: 'Reject' })} disabled={updateLeaveMutation.isPending} className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors"><X className="w-4 h-4"/></button>
                          </div>
                        ) : <span className="text-xs text-slate-400 font-medium">Processed</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ==========================================
// MAIN APP ENTRY
// ==========================================
function MainApplication() {
  const currentView = useSessionStore(state => state.currentView);
  const { data: initData, isLoading, isError, refetch } = useQuery({ queryKey: ['init'], queryFn: async () => { const res = await apiClient.get('/init'); return res.data; }, refetchOnWindowFocus: false, retry: 1 });
  const mutation = useMutation({ mutationFn: async ({ endpoint, payload }: any) => await apiClient.post(endpoint, payload), onSuccess: (data) => toast.success(data.data.message || 'Success!'), onError: (err: any) => toast.error(`Error: ${err.response?.data?.message || err.message}`) });

  return (
    <>
      <GlobalLoader active={isLoading || mutation.isPending} message={mutation.isPending ? "Processing..." : "Loading PW Gulf environment..."} />
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100/60 text-slate-800 font-sans">
        <aside className="w-full md:w-[280px] p-6 bg-slate-900 text-white flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-10 pb-6 border-b border-slate-800">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl"><GraduationCap className="w-6 h-6 text-white stroke-[2]" /></div>
              <div><h2 className="text-lg font-black flex items-center gap-1">PW Gulf <Sparkles className="w-3 h-3 text-amber-400" /></h2><p className="text-[10px] text-slate-400 uppercase">Faculty Portal</p></div>
            </div>
          </div>
        </aside>
        <main className="flex-1 p-6 md:p-12 w-full overflow-y-auto">
          {isError ? <ErrorBanner message="Network Error." onRetry={()=>refetch()} /> : (
            <>
              {currentView === 'home' && <HomeDashboard />}
              {currentView === 'session' && <ExtraClassForm initData={initData} isLoading={isLoading} mutation={mutation} />}
              {currentView === 'dpp' && <DPPForm initData={initData} isLoading={isLoading} mutation={mutation} />}
              {currentView === 'leave' && <LeaveForm initData={initData} isLoading={isLoading} mutation={mutation} />}
              {currentView === 'dashboard' && <LeaveDashboard />}
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default function App() { return <QueryClientProvider client={queryClient}><MainApplication /><Toaster position="bottom-right" /></QueryClientProvider>; }