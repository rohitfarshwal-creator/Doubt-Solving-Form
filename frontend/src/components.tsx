import React, { useState, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, Check, Loader2, ChevronDown, Search, AlertCircle } from 'lucide-react';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const Card = ({ children, className }: any) => (
  <div className={cn("glass-panel rounded-2xl shadow-luxury p-6 md:p-8 transition-all duration-300", className)}>
    {children}
  </div>
);

export const Label = ({ children, required, helper }: any) => (
  <div className="mb-2 flex items-center justify-between">
    <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-600">
      {children} {required && <span className="text-red-500 font-extrabold">*</span>}
    </label>
    {helper && <span className="text-[11px] font-medium text-slate-400 lowercase">{helper}</span>}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, any>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full px-4 py-3 bg-white/90 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium transition-all duration-200",
      "placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 focus:bg-white",
      "disabled:bg-slate-100/80 disabled:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-200",
      className
    )}
    {...props}
  />
));

export const Select = React.forwardRef<HTMLSelectElement, any>(({ className, children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        "w-full px-4 py-3 bg-white/90 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium transition-all duration-200 appearance-none pr-10",
        "focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 focus:bg-white cursor-pointer",
        "disabled:bg-slate-100/80 disabled:text-slate-400 disabled:cursor-not-allowed disabled:border-slate-200",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
  </div>
));

export const Button = React.forwardRef<HTMLButtonElement, any>(({ className, isLoading, children, ...props }, ref) => (
  <button
    ref={ref}
    disabled={isLoading || props.disabled}
    className={cn(
      "relative flex items-center justify-center gap-2.5 w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
      "text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 active:scale-[0.99] transition-all duration-200",
      "disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100",
      className
    )}
    {...props}
  >
    {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
    {children}
  </button>
));

export const Chip = ({ label, onRemove }: any) => (
  <div className="inline-flex items-center gap-1.5 bg-blue-50/80 hover:bg-blue-100/80 text-blue-700 px-3 py-1 rounded-lg text-xs font-semibold border border-blue-200/60 transition-colors shadow-sm animate-fade-in">
    <span>{label}</span>
    <button type="button" onClick={onRemove} className="p-0.5 rounded-md hover:bg-blue-200/50 text-blue-500 hover:text-blue-800 transition-colors">
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

export const GlobalLoader = ({ active, message = "Synchronizing PW Gulf Data..." }: { active: boolean, message?: string }) => {
  if (!active) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[9999] flex flex-col items-center justify-center animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-xs w-full mx-4 border border-slate-100">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-4 border-blue-100 animate-pulse"></div>
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin absolute inset-0" />
        </div>
        <h3 className="font-bold text-slate-800 text-sm mb-1">Please Wait</h3>
        <p className="text-xs text-slate-500 text-center font-medium">{message}</p>
      </div>
    </div>
  );
};

export const ErrorBanner = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
  <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center my-6 shadow-sm">
    <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
    <h3 className="text-base font-bold text-red-900 mb-1">Connection Error</h3>
    <p className="text-xs text-red-600 max-w-md mx-auto mb-4 font-medium">{message}</p>
    <button
      onClick={onRetry}
      type="button"
      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-red-500/20 transition-all"
    >
      Retry Connection
    </button>
  </div>
);

export function MultiSelect<T>({ items, selectedItems, itemKey, renderItem, onToggle, onSelectAll, onClearAll, placeholder, disabled }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = items.filter((i: any) => itemKey(i).toLowerCase().includes(search.toLowerCase()));
  const keys = selectedItems instanceof Set ? Array.from(selectedItems) : Array.from(selectedItems.keys());
  const isSelected = (i: any) => selectedItems.has(itemKey(i));

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 p-2 min-h-[46px] bg-white/90 border border-slate-200 rounded-xl cursor-text transition-all duration-200",
          isOpen && "border-blue-600 ring-4 ring-blue-600/10 bg-white",
          disabled && "bg-slate-100/80 border-slate-200 cursor-not-allowed opacity-75"
        )}
        onClick={() => { if (!disabled) { setIsOpen(true); inputRef.current?.focus(); } }}
      >
        {keys.map((k: any) => (
          <Chip key={k} label={k} onRemove={(e: any) => { e.stopPropagation(); onToggle(items.find((i: any) => itemKey(i) === k)); }} />
        ))}
        <div className="flex-1 flex items-center min-w-[140px] px-2 py-1">
          {keys.length === 0 && !search && <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />}
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400 disabled:cursor-not-allowed"
            placeholder={keys.length === 0 ? placeholder : ""}
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
            disabled={disabled}
          />
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 mr-2 transition-transform duration-200", isOpen && "rotate-180")} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-full max-h-[280px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-y-auto z-50 animate-fade-in divide-y divide-slate-100">
          <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50/80 backdrop-blur text-[11px] font-bold text-blue-600 sticky top-0 z-10 border-b border-slate-200/60 uppercase tracking-wider">
            <button type="button" className="hover:text-blue-800 transition-colors py-0.5" onClick={onSelectAll}>Select All ({items.length})</button>
            <button type="button" className="hover:text-red-600 text-slate-500 transition-colors py-0.5" onClick={onClearAll}>Clear All</button>
          </div>
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs font-medium">No results found for "{search}"</div>
          ) : (
            filtered.map((item: any) => {
              const selected = isSelected(item);
              return (
                <div
                  key={itemKey(item)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors text-sm font-medium",
                    selected ? "bg-blue-50/60 text-blue-900" : "hover:bg-slate-50 text-slate-700"
                  )}
                  onClick={() => { onToggle(item); inputRef.current?.focus(); }}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-all duration-150 shadow-sm",
                    selected ? "bg-blue-600 border-blue-600 text-white scale-105" : "border-slate-300 bg-white"
                  )}>
                    {selected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1 truncate">{renderItem(item)}</div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}