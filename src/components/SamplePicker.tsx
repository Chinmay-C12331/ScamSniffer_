import React from "react";
import { SAMPLE_CASES } from "../data/sampleCases";
import { SampleCase, RiskLevel } from "../types";
import { BookOpen, ArrowRight, ShieldAlert, CheckCircle2, AlertOctagon, Flame } from "lucide-react";

interface SamplePickerProps {
  onSelectSample: (sample: SampleCase, autoRun?: boolean) => void;
  onClose?: () => void;
}

export const SamplePicker: React.FC<SamplePickerProps> = ({ onSelectSample, onClose }) => {
  const getBadgeStyle = (risk: RiskLevel) => {
    switch (risk) {
      case "Critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "High":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low":
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
  };

  return (
    <div id="sample-cases-selector" className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Inspect Sample Scenarios & Benchmarks
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Test how ScamSniffer isolates evidence-based indicators across common fraud types and legitimate offers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {SAMPLE_CASES.map((sample) => (
          <div
            key={sample.id}
            id={`sample-card-${sample.id}`}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {sample.category}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getBadgeStyle(
                    sample.riskPreview
                  )}`}
                >
                  {sample.riskPreview} Risk
                </span>
              </div>

              <h4 className="text-sm font-bold text-slate-900 mb-1.5 line-clamp-1">
                {sample.title}
              </h4>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                {sample.description}
              </p>

              {sample.sender && (
                <div className="text-[11px] text-slate-500 font-mono truncate mb-3 bg-slate-50 p-1.5 rounded border border-slate-100">
                  {sample.sender}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  onSelectSample(sample, false);
                  if (onClose) onClose();
                }}
                className="flex-1 py-1.5 px-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center"
              >
                Load Text
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectSample(sample, true);
                  if (onClose) onClose();
                }}
                className="flex-1 py-1.5 px-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors text-center flex items-center justify-center gap-1"
              >
                <span>Analyze</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
