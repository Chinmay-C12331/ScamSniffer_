import React from "react";
import { ShieldAlert, ShieldCheck, History, BookOpen, Sparkles, RefreshCw } from "lucide-react";

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenSamples: () => void;
  onOpenSelfTest: () => void;
  onReset: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenSamples,
  onOpenSelfTest,
  onReset,
  historyCount,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onReset} id="header-brand-logo">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-sm border border-slate-700">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">ScamSniffer</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Security Analyst
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Evidence-based Job Offer & Appointment Letter Scam Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hackathon Evaluation Self-Test Button */}
          <button
            type="button"
            id="btn-header-self-test"
            onClick={onOpenSelfTest}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-900 rounded-lg border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
            title="Run Automated System Self-Test Suite for Hackathon Evaluation"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Run System Self-Test</span>
            <span className="md:hidden">Self-Test</span>
            <span className="hidden lg:inline-block text-[9px] px-1.5 py-0.5 bg-indigo-200/80 text-indigo-800 rounded font-bold uppercase tracking-wider">
              Eval
            </span>
          </button>

          <button
            type="button"
            id="btn-header-samples"
            onClick={onOpenSamples}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Inspect Samples</span>
            <span className="sm:hidden">Samples</span>
          </button>

          <button
            type="button"
            id="btn-header-history"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>History</span>
            {historyCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">
                {historyCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id="btn-header-reset"
            onClick={onReset}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Start New Analysis"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
