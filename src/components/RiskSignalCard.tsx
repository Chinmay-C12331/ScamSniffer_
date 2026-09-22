import React from "react";
import { RiskSignal, Severity } from "../types";
import { AlertCircle, AlertTriangle, ShieldX, Quote, ArrowRight } from "lucide-react";

interface RiskSignalCardProps {
  signal: RiskSignal;
  index: number;
}

export const RiskSignalCard: React.FC<RiskSignalCardProps> = ({ signal, index }) => {
  const getSeverityBadge = (severity: Severity) => {
    switch (severity) {
      case "High":
        return {
          pill: "bg-red-100 text-red-800 border-red-200",
          dot: "bg-red-500",
          icon: ShieldX,
          border: "border-red-200 hover:border-red-300",
        };
      case "Medium":
        return {
          pill: "bg-amber-100 text-amber-800 border-amber-200",
          dot: "bg-amber-500",
          icon: AlertTriangle,
          border: "border-amber-200 hover:border-amber-300",
        };
      case "Low":
      default:
        return {
          pill: "bg-slate-100 text-slate-700 border-slate-200",
          dot: "bg-slate-400",
          icon: AlertCircle,
          border: "border-slate-200 hover:border-slate-300",
        };
    }
  };

  const style = getSeverityBadge(signal.severity);
  const Icon = style.icon;

  return (
    <div
      id={`risk-signal-${index}`}
      className={`rounded-xl border ${style.border} bg-white p-4.5 shadow-xs transition-shadow hover:shadow-sm`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-slate-100 text-slate-700">
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-800">
            {signal.category}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          {signal.severity} Severity
        </span>
      </div>

      {/* Verbatim Evidence Quote */}
      <div className="mb-3 rounded-lg bg-slate-50 border border-slate-200/80 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          <Quote className="w-3 h-3 text-slate-400" />
          Observable Evidence:
        </div>
        <p className="text-xs sm:text-sm text-slate-800 font-mono italic leading-relaxed break-words">
          "{signal.evidence}"
        </p>
      </div>

      {/* Threat Impact Explanation */}
      <div className="flex items-start gap-2 pt-1 border-t border-slate-100 text-xs text-slate-700">
        <span className="font-semibold text-slate-900 flex-shrink-0 flex items-center gap-1">
          <ArrowRight className="w-3 h-3 text-slate-400" /> Threat Impact:
        </span>
        <span className="leading-relaxed">{signal.impact}</span>
      </div>
    </div>
  );
};
