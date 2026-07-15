import React, { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { create } from 'zustand';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { 
  GraduationCap, Save, Sparkles, Building2, Calendar, CheckCircle2, 
  ArrowLeft, FileText, Users, Plus, Trash2, ExternalLink 
} from 'lucide-react';
import { Card, Label, Input, Select, Button, GlobalLoader, MultiSelect, ErrorBanner } from './components';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});
const queryClient = new QueryClient();

// ==========================================
// ZUSTAND GLOBAL STATE
// ==========================================
interface SessionStore {
  currentView: 'home' | 'session' | 'dpp';
  cohort: string;
  centre: string;
  sessionType: string;
  selectedBatches: Set<string>;
  selectedStudents: Map<string, any>;
  setCurrentView: (v: 'home' | 'session' | 'dpp') => void;
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
  currentView: 'home',
  cohort: '',
  centre: '',
  sessionType: '',
  selectedBatches: new Set<string>(),
  selectedStudents: new Map<string, any>(),

  setCurrentView: (view) => set({ currentView: view }),
  setCohort: (cohort) => set({ cohort, centre: '', selectedBatches: new Set(), selectedStudents: new Map() }),
  setCentre: (centre) => set({ centre, selectedBatches: new Set(), selectedStudents: new Map() }),
  setSessionType: (sessionType) => set({ sessionType, selectedStudents: new Map() }),

  toggleBatch: (batch) => set((state) => {
    const b = new Set(state.selectedBatches);
    b.has(batch) ? b.delete(batch) : b.add(batch);
    const s = new Map(state.selectedStudents);
    for (const [name, stu] of s.entries()) {
      if (!b.has(stu.batch)) s.delete(name);
    }
    return { selectedBatches: b, selectedStudents: s };
  }),

  selectAllBatches: (batches) => set({ selectedBatches: new Set(batches) }),
  clearAllBatches: () => set({ selectedBatches: new Set(), selectedStudents: new Map() }),

  toggleStudent: (student) => set((state) => {
    const s = new Map(state.selectedStudents);
    s.has(student.name) ? s.delete(student.name) : s.set(student.name, student);
    return { selectedStudents: s };
  }),

  selectAllStudents: (students) => {
    const s = new Map<string, any>();
    students.forEach(stu => s.set(stu.name, stu));
    set({ selectedStudents: s });
  },
  
  clearAllStudents: () => set({ selectedStudents: new Map() }),
  
  resetFormState: () => set({ cohort: '', centre: '', sessionType: '', selectedBatches: new Set(), selectedStudents: new Map() })
}));


// ==========================================
// HOME DASHBOARD VIEW
// ==========================================
function HomeDashboard() {
  const setView = useSessionStore(state => state.setCurrentView);
  const resetFormState = useSessionStore(state => state.resetFormState);

  const navigateTo = (view: 'session' | 'dpp') => {
    resetFormState();
    setView(view);
  };

  return (
    <div className="max-w-4xl mx-auto w-full animate-fade-in py-12">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl shadow-blue-500/30 mb-6">
          <GraduationCap className="w-12 h-12 text-white stroke-[2]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">PW Gulf Faculty Portal</h1>
        <p className="text-slate-500 text-lg font-medium">Select a module to log your session or submit materials.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-6">
        <button 
          onClick={() => navigateTo('session')}
          className="group text-left p-8 rounded-3xl bg-white border border-slate-200 shadow-lg hover:shadow-2xl hover:border-blue-400 transition-all duration-300 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-32 h-32 text-blue-600" />
          </div>
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
            <Users className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Extra Class Session</h2>
          <p className="text-slate-500 font-medium">Log 1:1, SGC, or LGC doubt classes and track student attendance.</p>
        </button>

        <button 
          onClick={() => navigateTo('dpp')}
          className="group text-left p-8 rounded-3xl bg-white border border-slate-200 shadow-lg hover:shadow-2xl hover:indigo-400 transition-all duration-300 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileText className="w-32 h-32 text-indigo-600" />
          </div>
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
            <FileText className="w-7 h-7 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">DPP Form</h2>
          <p className="text-slate-500 font-medium">Submit daily practice problems, homework topics, and batch attachments.</p>
        </button>
      </div>
    </div>
  );
}


// ==========================================
// 1. EXTRA CLASS SESSION FORM (Existing)
// ==========================================
function ExtraClassForm({ initData, isLoading, mutation }: any) {
  const store = useSessionStore();
  const setView = useSessionStore(state => state.setCurrentView);
  const { register, handleSubmit, reset } = useForm<any>({
    defaultValues: { date: new Date().toISOString().split('T')[0] }
  });

  const reqCentre = store.cohort === 'Qatar Offline';

  const teachers = useMemo(() => {
    if (!initData?.teachers || !store.cohort) return [];
    const filtered = initData.teachers.filter((t: any) => t.cohort === store.cohort);
    return Array.from(new Set<string>(filtered.map((t: any) => t.name))).sort();
  }, [initData, store.cohort]);

  const centres = useMemo(() => {
    if (!initData?.students || !store.cohort) return [];
    const filtered = initData.students.filter((s: any) => s.cohort === store.cohort && s.branch);
    return Array.from(new Set<string>(filtered.map((s: any) => s.branch))).sort();
  }, [initData, store.cohort]);

  const batches = useMemo(() => {
    if (!initData?.students || !store.cohort) return [];
    let filtered = initData.students.filter((s: any) => s.cohort === store.cohort);
    if (reqCentre && store.centre) filtered = filtered.filter((s: any) => s.branch === store.centre);
    return Array.from(new Set<string>(filtered.map((s: any) => s.batch).filter(Boolean))).sort();
  }, [initData, store.cohort, store.centre, reqCentre]);
  
  const students = useMemo(() => {
    if (!initData?.students || store.selectedBatches.size === 0) return [];
    const bArr = Array.from(store.selectedBatches);
    let filtered = initData.students.filter((s: any) => s.cohort === store.cohort && bArr.includes(s.batch));
    if (reqCentre && store.centre) filtered = filtered.filter((s: any) => s.branch === store.centre);
    const unique = new Map<string, any>();
    filtered.forEach((s: any) => unique.set(s.name, s));
    return Array.from(unique.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [initData, store.cohort, store.selectedBatches, store.centre, reqCentre]);

  const onSubmit = (data: any) => {
    if (!store.cohort) return toast.error('Please select a Cohort.');
    const teacherEl = document.getElementById('teacher') as HTMLSelectElement;
    if (!teacherEl || !teacherEl.value) return toast.error('Please select a Teacher / Mentor.');
    if (reqCentre && !store.centre) return toast.error('Please select a Centre Name for Qatar Offline.');
    if (!store.sessionType) return toast.error('Please select a Session Type.');
    if (store.selectedBatches.size === 0) return toast.error('Please select at least one Batch.');
    
    let finalStudents: any[] = [];
    if (store.sessionType === '1:1') {
      const el = document.getElementById('singleStudent') as HTMLSelectElement;
      if (!el || !el.value) return toast.error('Please select a Student for 1:1 session.');
      finalStudents.push(JSON.parse(el.value));
    } else {
      if (store.selectedStudents.size === 0) return toast.error('Please select at least one Student.');
      finalStudents = Array.from(store.selectedStudents.values());
    }

    mutation.mutate(
      {
        endpoint: '/session',
        payload: {
          ...data,
          cohort: store.cohort,
          branch: reqCentre ? store.centre : '',
          teacher: teacherEl.value,
          sessionType: store.sessionType,
          batchesList: Array.from(store.selectedBatches).join(', '),
          selectedStudentsData: finalStudents,
          studentsList: finalStudents.map(s => s.name).join(', ')
        }
      },
      {
        onSuccess: () => {
          reset({ date: new Date().toISOString().split('T')[0], subject: '', topic: '', duration: '', notes: '' });
          store.resetFormState();
          if (teacherEl) teacherEl.value = '';
        }
      }
    );
  };

  return (
    <div className="animate-fade-in">
      <header className="mb-8 md:mb-10">
        <button onClick={() => setView('home')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider mb-3 ml-4">
          <Users className="w-3.5 h-3.5" /> Extra Class Module
        </div>
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">Log Extra Class Session</h1>
        <p className="text-slate-500 text-sm font-medium mt-1.5">Record comprehensive details for 1:1, SGC, or LGC doubt classes.</p>
      </header>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="w-full">
              <Label required helper="Filters mentor list">Cohort</Label>
              <Select value={store.cohort} onChange={(e: any) => store.setCohort(e.target.value)} disabled={isLoading || mutation.isPending} required>
                <option value="" disabled>Select a Cohort...</option>
                {initData?.cohorts?.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="w-full">
              <Label required helper="Auto-mapped to cohort">Teacher / Mentor</Label>
              <Select id="teacher" disabled={!store.cohort || isLoading || mutation.isPending} defaultValue="" required>
                <option value="" disabled>Waiting for Cohort...</option>
                {teachers.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </div>

          {reqCentre && (
            <div className="grid grid-cols-1 gap-6 p-5 rounded-2xl bg-blue-50/50 border border-blue-100 animate-fade-in">
              <div className="w-full">
                <Label required helper="Strictly required for Qatar Offline">Centre Name (Branch)</Label>
                <Select value={store.centre} onChange={(e: any) => store.setCentre(e.target.value)} disabled={mutation.isPending} required>
                  <option value="" disabled>Select Centre...</option>
                  {centres.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="w-full">
              <Label required helper="Session date">Date of Session</Label>
              <Input type="date" {...register('date')} disabled={mutation.isPending} required />
            </div>
            <div className="w-full">
              <Label required helper="Determines student selection mode">Session Type</Label>
              <Select value={store.sessionType} onChange={(e: any) => store.setSessionType(e.target.value)} disabled={mutation.isPending} required>
                <option value="" disabled>Select Session Type...</option>
                <option value="1:1">1:1 (Single Student Doubt Solving)</option>
                <option value="SGC">SGC (Short Group Discussion - Multi Student)</option>
                <option value="LGC">LGC (Large Group Discussion - Multi Student)</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="w-full">
              <Label required helper="Multi-select support">Batches</Label>
              <MultiSelect
                items={batches}
                selectedItems={store.selectedBatches}
                itemKey={(b: string) => b}
                renderItem={(b: string) => <span className="font-bold text-slate-700">{b}</span>}
                onToggle={store.toggleBatch}
                onSelectAll={() => store.selectAllBatches(batches)}
                onClearAll={store.clearAllBatches}
                placeholder={!store.cohort ? "Select Cohort first..." : batches.length === 0 ? "No batches available" : "Search & select batches..."}
                disabled={batches.length === 0 || mutation.isPending}
              />
            </div>
            <div className="w-full">
              <Label required helper="Curriculum subject">Subject</Label>
              <Select {...register('subject')} disabled={mutation.isPending} defaultValue="" required>
                <option value="" disabled>Select Subject...</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Maths">Maths</option>
                <option value="Biology">Biology</option>
                <option value="Social Science">Social Science</option>
                <option value="Science(Combined)">Science(Combined)</option>
              </Select>
            </div>
          </div>

          {store.sessionType === '1:1' && (
            <div className="grid grid-cols-1 gap-6 p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 animate-fade-in">
              <div className="w-full">
                <Label required helper="Filtered by selected batches">Select Student (1:1 Mode)</Label>
                <Select id="singleStudent" disabled={students.length === 0 || mutation.isPending} defaultValue="" required>
                  <option value="" disabled>{store.selectedBatches.size === 0 ? "Waiting for Batch selection..." : "Select Student..."}</option>
                  {students.map((s: any) => <option key={s.name} value={JSON.stringify(s)}>{s.name} (Grade: {s.grade || 'N/A'} | Batch: {s.batch})</option>)}
                </Select>
              </div>
            </div>
          )}

          {(store.sessionType === 'SGC' || store.sessionType === 'LGC') && (
            <div className="grid grid-cols-1 gap-6 p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 animate-fade-in">
              <div className="w-full">
                <Label required helper="Search by name, grade or batch">Select Students (Group Mode)</Label>
                <MultiSelect
                  items={students}
                  selectedItems={store.selectedStudents}
                  itemKey={(s: any) => s.name}
                  renderItem={(s: any) => (
                    <div className="flex flex-col py-0.5">
                      <span className="font-bold text-slate-800">{s.name}</span>
                      <span className="text-[11px] font-semibold text-slate-400">Batch: <strong className="text-blue-600">{s.batch}</strong> | Grade: {s.grade || 'N/A'}</span>
                    </div>
                  )}
                  onToggle={store.toggleStudent}
                  onSelectAll={() => store.selectAllStudents(students)}
                  onClearAll={store.clearAllStudents}
                  placeholder={store.selectedBatches.size === 0 ? "Waiting for Batch selection..." : "Search & select students..."}
                  disabled={students.length === 0 || mutation.isPending}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="w-full">
              <Label required helper="Specific doubt covered">Topic Discussed</Label>
              <Input {...register('topic')} placeholder="E.g., Kinematics Rotational Dynamics Doubt Solving" disabled={mutation.isPending} required />
            </div>
            <div className="w-full">
              <Label required helper="Class length in minutes">Class Duration</Label>
              <Select {...register('duration')} disabled={mutation.isPending} defaultValue="" required>
                <option value="" disabled>Select Duration...</option>
                {[15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180].map(m => <option key={m} value={m}>{m} minutes ({m/60} hrs)</option>)}
              </Select>
            </div>
          </div>

          <div className="w-full">
            <Label helper="Optional faculty observations">Additional Notes</Label>
            <textarea
              {...register('notes')}
              className="w-full p-4 bg-white/90 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 disabled:bg-slate-100"
              rows={3}
              placeholder="Any specific student observations, homework assigned, or follow-up needed?"
              disabled={mutation.isPending} 
            />
          </div>

          <div className="pt-4 border-t border-slate-200/60 flex justify-end">
            <Button type="submit" isLoading={mutation.isPending} className="md:w-auto md:min-w-[240px] shadow-xl shadow-blue-600/20">
              <Save className="w-4 h-4 stroke-[2.5]" /> Save Session Record
            </Button>
          </div>

        </form>
      </Card>
    </div>
  );
}


// ==========================================
// 2. DPP FORM (Multi-Entry logic)
// ==========================================
function DPPForm({ initData, isLoading, mutation }: any) {
  const store = useSessionStore();
  const setView = useSessionStore(state => state.setCurrentView);
  
  // Setup React-Hook-Form with dynamic array for multiple days/entries
  const { register, control, handleSubmit, reset } = useForm<any>({
    defaultValues: { 
      entries: [{ date: new Date().toISOString().split('T')[0], topic: '', notes: '', attachment: '' }] 
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "entries"
  });

  const reqCentre = store.cohort === 'Qatar Offline';

  const teachers = useMemo(() => {
    if (!initData?.teachers || !store.cohort) return [];
    const filtered = initData.teachers.filter((t: any) => t.cohort === store.cohort);
    return Array.from(new Set<string>(filtered.map((t: any) => t.name))).sort();
  }, [initData, store.cohort]);

  const centres = useMemo(() => {
    if (!initData?.students || !store.cohort) return [];
    const filtered = initData.students.filter((s: any) => s.cohort === store.cohort && s.branch);
    return Array.from(new Set<string>(filtered.map((s: any) => s.branch))).sort();
  }, [initData, store.cohort]);

  const batches = useMemo(() => {
    if (!initData?.students || !store.cohort) return [];
    let filtered = initData.students.filter((s: any) => s.cohort === store.cohort);
    if (reqCentre && store.centre) filtered = filtered.filter((s: any) => s.branch === store.centre);
    return Array.from(new Set<string>(filtered.map((s: any) => s.batch).filter(Boolean))).sort();
  }, [initData, store.cohort, store.centre, reqCentre]);

  const onSubmit = (data: any) => {
    if (!store.cohort) return toast.error('Please select a Cohort.');
    const teacherEl = document.getElementById('teacherDpp') as HTMLSelectElement;
    if (!teacherEl || !teacherEl.value) return toast.error('Please select a Teacher / Mentor.');
    if (reqCentre && !store.centre) return toast.error('Please select a Centre Name for Qatar Offline.');
    if (store.selectedBatches.size === 0) return toast.error('Please select at least one Batch.');

    mutation.mutate(
      {
        endpoint: '/dpp',
        payload: {
          cohort: store.cohort,
          branch: reqCentre ? store.centre : '',
          teacher: teacherEl.value,
          batchesList: Array.from(store.selectedBatches).join(', '),
          subject: data.subject,
          entries: data.entries // The dynamic array of days
        }
      },
      {
        onSuccess: () => {
          reset({ entries: [{ date: new Date().toISOString().split('T')[0], topic: '', notes: '', attachment: '' }] });
          store.resetFormState();
          if (teacherEl) teacherEl.value = '';
        }
      }
    );
  };

  return (
    <div className="animate-fade-in">
      <header className="mb-8 md:mb-10">
        <button onClick={() => setView('home')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/80 border border-indigo-200 text-indigo-800 text-xs font-bold uppercase tracking-wider mb-3 ml-4">
          <FileText className="w-3.5 h-3.5" /> DPP Module
        </div>
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">DPP Form</h1>
        <p className="text-slate-500 text-sm font-medium mt-1.5">Submit homework and practice problems. Add multiple entries to submit a whole week at once!</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* FIXED TOP SECTION */}
        <Card className="border-indigo-100 shadow-indigo-900/5">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-indigo-500"/> Master Information</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="w-full">
              <Label required helper="Filters mentor list">Cohort</Label>
              <Select value={store.cohort} onChange={(e: any) => store.setCohort(e.target.value)} disabled={isLoading || mutation.isPending} required>
                <option value="" disabled>Select a Cohort...</option>
                {initData?.cohorts?.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="w-full">
              <Label required helper="Auto-mapped to cohort">Teacher / Mentor</Label>
              <Select id="teacherDpp" disabled={!store.cohort || isLoading || mutation.isPending} defaultValue="" required>
                <option value="" disabled>Waiting for Cohort...</option>
                {teachers.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </div>

          {reqCentre && (
            <div className="grid grid-cols-1 gap-6 mb-6">
              <div className="w-full">
                <Label required helper="Strictly required for Qatar Offline">Centre Name (Branch)</Label>
                <Select value={store.centre} onChange={(e: any) => store.setCentre(e.target.value)} disabled={mutation.isPending} required>
                  <option value="" disabled>Select Centre...</option>
                  {centres.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="w-full">
              <Label required helper="Multi-select support">Batch</Label>
              <MultiSelect
                items={batches}
                selectedItems={store.selectedBatches}
                itemKey={(b: string) => b}
                renderItem={(b: string) => <span className="font-bold text-slate-700">{b}</span>}
                onToggle={store.toggleBatch}
                onSelectAll={() => store.selectAllBatches(batches)}
                onClearAll={store.clearAllBatches}
                placeholder={!store.cohort ? "Select Cohort first..." : batches.length === 0 ? "No batches available" : "Search & select batches..."}
                disabled={batches.length === 0 || mutation.isPending}
              />
            </div>
            <div className="w-full">
              <Label required helper="Curriculum subject">Subject</Label>
              <Select {...register('subject')} disabled={mutation.isPending} defaultValue="" required>
                <option value="" disabled>Select Subject...</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Maths">Maths</option>
                <option value="Biology">Biology</option>
                <option value="Social Science">Social Science</option>
                <option value="Science(Combined)">Science(Combined)</option>
              </Select>
            </div>
          </div>
        </Card>

        {/* DYNAMIC ENTRIES SECTION */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-slate-800 text-lg">Daily Entries</h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{fields.length} {fields.length === 1 ? 'Entry' : 'Entries'}</span>
          </div>
          
          {fields.map((item, index) => (
            <Card key={item.id} className="relative border-l-4 border-l-indigo-500 animate-fade-in shadow-md">
              
              {/* Delete button (only show if more than 1 entry) */}
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              
              <div className="mb-4">
                <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 font-bold text-xs rounded-md">Entry #{index + 1}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="w-full">
                  <Label required helper="Date of the homework">Date of DPP</Label>
                  <Input type="date" {...register(`entries.${index}.date`)} required disabled={mutation.isPending} />
                </div>
                <div className="w-full">
                  <Label required helper="Specific topic assigned">Home Work Topic</Label>
                  <Input {...register(`entries.${index}.topic`)} placeholder="E.g., Kinematics Formulas" required disabled={mutation.isPending} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 mb-6">
                <div className="w-full">
                  <Label helper="Optional instructions">Additional Notes</Label>
                  <textarea
                    {...register(`entries.${index}.notes`)}
                    className="w-full p-4 bg-white/90 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                    rows={2}
                    placeholder="Any specific instructions for this homework?"
                    disabled={mutation.isPending} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label helper="Paste the link to the file">Attachment Link</Label>
                    <a href="https://drive.google.com/drive/folders/1W5DOjAp3tI2aMBzKpSZ_n5C5g9xs9NE4?usp=drive_link" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-100/50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Upload to Drive First
                    </a>
                  </div>
                  <Input {...register(`entries.${index}.attachment`)} placeholder="https://drive.google.com/file/d/..." disabled={mutation.isPending} />
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">To avoid server limits, please upload your file to the official Drive folder using the button above, then paste the generated link here.</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200/60">
          <button 
            type="button" 
            onClick={() => append({ date: new Date().toISOString().split('T')[0], topic: '', notes: '', attachment: '' })}
            disabled={mutation.isPending}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border-2 border-dashed border-indigo-300 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 hover:border-indigo-500 w-full md:w-auto transition-all"
          >
            <Plus className="w-5 h-5" /> Add Another Day / Entry
          </button>

          <Button type="submit" isLoading={mutation.isPending} className="w-full md:w-auto md:min-w-[280px] bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 py-3.5">
            <Save className="w-5 h-5 stroke-[2.5]" /> Submit All DPP Entries
          </Button>
        </div>

      </form>
    </div>
  );
}


// ==========================================
// MAIN APP COMPONENT
// ==========================================
function MainApplication() {
  const currentView = useSessionStore(state => state.currentView);
  
  const { data: initData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['init'],
    queryFn: async () => {
      const res = await apiClient.get('/init');
      return res.data;
    },
    refetchOnWindowFocus: false,
    retry: 1
  });

  const mutation = useMutation({
    mutationFn: async ({ endpoint, payload }: { endpoint: string, payload: any }) => {
      return await apiClient.post(endpoint, payload);
    },
    onSuccess: (data) => {
      toast.success(data.data.message || 'Successfully recorded!', {
        icon: '🎉',
        style: { borderRadius: '12px', background: '#0f172a', color: '#fff', fontSize: '13px', fontWeight: '600' }
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Server connection failed.';
      toast.error(`Error: ${msg}`, { style: { borderRadius: '12px', background: '#dc2626', color: '#fff', fontSize: '13px' } });
    }
  });

  return (
    <>
      <GlobalLoader active={isLoading || mutation.isPending} message={mutation.isPending ? "Connecting to Google Sheets..." : "Loading PW Gulf environment..."} />
      
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100/60 text-slate-800 font-sans">
        {/* SIDEBAR (Visible on all views) */}
        <aside className="w-full md:w-[300px] p-6 md:p-8 bg-slate-900 text-white flex flex-col justify-between shadow-2xl z-10 shrink-0">
          <div>
            <div className="flex items-center gap-3.5 mb-10 pb-6 border-b border-slate-800">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                <GraduationCap className="w-7 h-7 text-white stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  PW Gulf <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                </h2>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Faculty Portal</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> System Status
                </h4>
                <p className={`text-sm font-bold ${mutation.isPending ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                  {mutation.isPending ? 'Writing to Database...' : 'Ready to Submit'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" /> Active Environment
                </h4>
                <p className="text-sm font-bold text-slate-200">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
            </div>
          </div>
        </aside>
        
        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full overflow-y-auto">
          {isError ? (
            <ErrorBanner message={`Cannot reach backend server (${error?.message || 'Network Error'}). Ensure backend is running.`} onRetry={() => refetch()} />
          ) : (
            <>
              {currentView === 'home' && <HomeDashboard />}
              {currentView === 'session' && <ExtraClassForm initData={initData} isLoading={isLoading} mutation={mutation} />}
              {currentView === 'dpp' && <DPPForm initData={initData} isLoading={isLoading} mutation={mutation} />}
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApplication />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}