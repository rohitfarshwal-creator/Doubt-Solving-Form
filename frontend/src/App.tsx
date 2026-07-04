import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { create } from 'zustand';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { GraduationCap, Save, Sparkles, Building2, Calendar, BookOpen, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { Card, Label, Input, Select, Button, GlobalLoader, MultiSelect, ErrorBanner } from './components';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});
const queryClient = new QueryClient();

interface SessionStore {
  cohort: string;
  centre: string;
  sessionType: string;
  selectedBatches: Set<string>;
  selectedStudents: Map<string, any>;
  setCohort: (c: string) => void;
  setCentre: (c: string) => void;
  setSessionType: (t: string) => void;
  toggleBatch: (b: string) => void;
  selectAllBatches: (b: string[]) => void;
  clearAllBatches: () => void;
  toggleStudent: (s: any) => void;
  selectAllStudents: (s: any[]) => void;
  clearAllStudents: () => void;
  resetState: () => void;
}

const useSessionStore = create<SessionStore>((set) => ({
  cohort: '',
  centre: '',
  sessionType: '',
  selectedBatches: new Set(),
  selectedStudents: new Map(),

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
    const s = new Map();
    students.forEach(stu => s.set(stu.name, stu));
    set({ selectedStudents: s });
  },
  
  clearAllStudents: () => set({ selectedStudents: new Map() }),
  
  resetState: () => set({ cohort: '', centre: '', sessionType: '', selectedBatches: new Set(), selectedStudents: new Map() })
}));

function SessionLogApp() {
  const store = useSessionStore();
  const { register, handleSubmit, reset } = useForm<any>({
    defaultValues: { date: new Date().toISOString().split('T')[0] }
  });

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
    mutationFn: async (payload: any) => await apiClient.post('/session', payload),
    onSuccess: () => {
      toast.success('Session successfully recorded!', {
        icon: '🎉',
        style: { borderRadius: '12px', background: '#0f172a', color: '#fff', fontSize: '13px', fontWeight: '600' }
      });
      reset({ date: new Date().toISOString().split('T')[0], subject: '', topic: '', duration: '', notes: '' });
      store.resetState();
      const teacherEl = document.getElementById('teacher') as HTMLSelectElement;
      if (teacherEl) teacherEl.value = '';
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Server connection failed.';
      toast.error(`Error: ${msg}`, { style: { borderRadius: '12px', background: '#dc2626', color: '#fff', fontSize: '13px' } });
    }
  });

  const reqCentre = store.cohort === 'Qatar Offline';

  // FIX: Added strong optional chaining and fallbacks to prevent fatal crashes
  const teachers = useMemo(() => initData?.cohortTeachers?.[store.cohort] || [], [initData, store.cohort]);
  const centres = useMemo(() => initData?.cohortBranches?.[store.cohort] || [], [initData, store.cohort]);

  const batches = useMemo(() => {
    if (!initData || !initData.students) return []; // FIX: Stop execution if backend data is missing
    if (reqCentre && store.centre) {
      const bSet = new Set<string>();
      initData.students.forEach((s: any) => {
        if (s.branch === store.centre) bSet.add(s.batch);
      });
      return Array.from(bSet).sort();
    }
    return initData?.cohortBatches?.[store.cohort] || []; // FIX: Optional chaining
  }, [initData, store.cohort, store.centre, reqCentre]);
  
  const students = useMemo(() => {
    if (!initData || !initData.students || store.selectedBatches.size === 0) return []; // FIX: Stop execution if backend data is missing
    const bArr = Array.from(store.selectedBatches);
    const filtered = initData.students.filter((s: any) => {
      let match = bArr.includes(s.batch);
      if (reqCentre && store.centre) match = match && (s.branch === store.centre);
      return match;
    });
    const unique = new Map();
    filtered.forEach((s: any) => unique.set(s.name, s));
    return Array.from(unique.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [initData, store.selectedBatches, store.centre, reqCentre]);

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

    const studentMeta = finalStudents.length > 0 ? finalStudents[0] : {};
    const branchVal = reqCentre ? store.centre : (studentMeta.branch || '');

    mutation.mutate({
      ...data,
      cohort: store.cohort,
      branch: branchVal,
      teacher: teacherEl.value,
      sessionType: store.sessionType,
      batchesList: Array.from(store.selectedBatches).join(', '),
      selectedStudentsData: finalStudents,
      studentsList: finalStudents.map(s => s.name).join(', ')
    });
  };

  return (
    <>
      <GlobalLoader active={isLoading || mutation.isPending} message={mutation.isPending ? "Recording session in Google Sheets..." : "Loading PW Gulf environment..."} />
      
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100/60 text-slate-800 font-sans">
        
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
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Doubt Solving Portal</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> System Status
                </h4>
                <p className={`text-sm font-bold ${mutation.isPending ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                  {mutation.isPending ? 'Writing to Sheet...' : 'Ready to Log Session'}
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

          <div className="mt-12 pt-6 border-t border-slate-800/80 text-center md:text-left">
            <p className="text-[11px] font-medium text-slate-500">Enterprise Edition v2.4</p>
            <p className="text-[10px] text-slate-600 font-semibold mt-0.5">Strict Apps Script Parity</p>
          </div>
        </aside>
        
        <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full overflow-y-auto">
          <header className="mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider mb-3">
              <Building2 className="w-3.5 h-3.5" /> Official Faculty Portal
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">Log Extra Class Session</h1>
            <p className="text-slate-500 text-sm font-medium mt-1.5">Record comprehensive details for 1:1, Short Group (SGC), or Large Group (LGC) doubt classes.</p>
          </header>

          {isError ? (
            <ErrorBanner message={`Cannot reach backend server (${error?.message || 'Network Error'}). Ensure 'npx ts-node-dev src/server.ts' is running in your backend terminal.`} onRetry={() => refetch()} />
          ) : (
            <Card>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-50/70 border border-slate-100">
                  <div>
                    <Label required helper="Filters mentor list">Cohort</Label>
                    <Select
                      value={store.cohort}
                      onChange={(e: any) => store.setCohort(e.target.value)}
                      disabled={isLoading || mutation.isPending}
                      required
                    >
                      <option value="" disabled>Select a Cohort...</option>
                      {/* FIX: Added safe optional chaining for the .map function */}
                      {initData?.cohorts?.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label required helper="Auto-mapped to cohort">Teacher / Mentor</Label>
                    <Select id="teacher" disabled={!store.cohort || isLoading || mutation.isPending} required>
                      <option value="" disabled>Waiting for Cohort...</option>
                      {teachers.map((t: string) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                </div>

                {reqCentre && (
                  <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 animate-fade-in">
                    <Label required helper="Strictly required for Qatar Offline">Centre Name (Branch)</Label>
                    <Select
                      value={store.centre}
                      onChange={(e: any) => store.setCentre(e.target.value)}
                      disabled={mutation.isPending}
                      required
                    >
                      <option value="" disabled>Select Centre...</option>
                      {centres.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label required helper="Session date">Date of Session</Label>
                    <Input type="date" {...register('date')} disabled={mutation.isPending} required />
                  </div>
                  <div>
                    <Label required helper="Determines student selection mode">Session Type</Label>
                    <Select
                      value={store.sessionType}
                      onChange={(e: any) => store.setSessionType(e.target.value)}
                      disabled={mutation.isPending}
                      required
                    >
                      <option value="" disabled>Select Session Type...</option>
                      <option value="1:1">1:1 (Single Student Doubt Solving)</option>
                      <option value="SGC">SGC (Short Group Discussion - Multi Student)</option>
                      <option value="LGC">LGC (Large Group Discussion - Multi Student)</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
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
                  <div>
                    <Label required helper="Curriculum subject">Subject</Label>
                    <Select {...register('subject')} disabled={mutation.isPending} required>
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
                  <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 animate-fade-in">
                    <Label required helper="Filtered by selected batches">Select Student (1:1 Mode)</Label>
                    <Select id="singleStudent" disabled={students.length === 0 || mutation.isPending} required>
                      <option value="" disabled>{store.selectedBatches.size === 0 ? "Waiting for Batch selection..." : "Select Student..."}</option>
                      {students.map((s: any) => <option key={s.name} value={JSON.stringify(s)}>{s.name} (Grade: {s.grade || 'N/A'} | Batch: {s.batch})</option>)}
                    </Select>
                  </div>
                )}

                {(store.sessionType === 'SGC' || store.sessionType === 'LGC') && (
                  <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 animate-fade-in">
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
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label required helper="Specific doubt covered">Topic Discussed</Label>
                    <Input {...register('topic')} placeholder="E.g., Kinematics Rotational Dynamics Doubt Solving" disabled={mutation.isPending} required />
                  </div>
                  <div>
                    <Label required helper="Class length in minutes">Class Duration</Label>
                    <Select {...register('duration')} disabled={mutation.isPending} required>
                      <option value="" disabled>Select Duration...</option>
                      {[15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180].map(m => (
                        <option key={m} value={m}>{m} minutes ({m/60} hrs)</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
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
          )}
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionLogApp />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}