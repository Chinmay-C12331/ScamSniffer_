import React, { useState } from "react";
import { ScamAnalysisResult } from "../types";
import { ThreatMeter } from "./ThreatMeter";
import { RiskSignalCard } from "./RiskSignalCard";
import { DomainAnalysisCard } from "./DomainAnalysisCard";
import {
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ListChecks,
  Copy,
  Check,
  Download,
  Share2,
  Info,
  Filter,
} from "lucide-react";

interface AnalysisResultsProps {
  result: ScamAnalysisResult;
  onNewScan: () => void;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result, onNewScan }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [copied, setCopied] = useState<boolean>(false);

  const categories = [
    "ALL",
    ...Array.from(new Set(result.risk_signals.map((s) => s.category))),
  ];

  const filteredSignals =
    selectedCategory === "ALL"
      ? result.risk_signals
      : result.risk_signals.filter((s) => s.category === selectedCategory);

  const handleCopyReport = () => {
    const jsonStr = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ScamSniffer-Report-${result.risk_level}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="analysis-results-container" className="space-y-6">
      {/* Top Threat Meter */}
      <ThreatMeter
        threatIndex={result.threat_index}
        riskLevel={result.risk_level}
        confidence={result.confidence}
        summary={result.summary}
      />

      {/* Toolbar actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span>
            Identified {result.risk_signals.length} Risk Signal
            {result.risk_signals.length !== 1 ? "s" : ""} & {result.positive_signals.length} Positive Signal
            {result.positive_signals.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-copy-report"
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied JSON!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy JSON Report</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="btn-download-report"
            onClick={handleDownloadReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download JSON</span>
          </button>

          <button
            type="button"
            id="btn-new-scan"
            onClick={onNewScan}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
          >
            Scan Another Offer
          </button>
        </div>
      </div>

      {/* Main Grid: Signals & Domain Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Risk Signals Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              Evidence-Based Risk Signals
            </h3>

            {/* Category Filter Chips */}
            {categories.length > 2 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      selectedCategory === cat
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredSignals.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 bg-white">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                No high risk indicators found for this category
              </p>
              <p className="text-xs text-slate-500 mt-1">
                The offer does not display identifiable scam patterns under this category.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSignals.map((signal, idx) => (
                <RiskSignalCard key={idx} signal={signal} index={idx} />
              ))}
            </div>
          )}

          {/* Domain & URL Risk Section */}
          <DomainAnalysisCard analysis={result.domain_analysis} />
        </div>

        {/* Right Col: Positive Signals, Verification Gaps & Next Actions */}
        <div className="space-y-5">
          {/* Tactical Recommended Actions */}
          <div
            id="recommended-actions-card"
            className="rounded-xl border border-amber-200 bg-amber-50/50 p-4.5 shadow-xs"
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
              <ListChecks className="w-4 h-4 text-amber-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Recommended Actions
              </h4>
            </div>

            <ul className="space-y-2.5">
              {result.recommended_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-950 leading-relaxed">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Positive Signals Card */}
          <div
            id="positive-signals-card"
            className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4.5 shadow-xs"
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Legitimate / Positive Signals
              </h4>
            </div>

            {result.positive_signals.length === 0 ? (
              <p className="text-xs text-emerald-800 italic">
                No conventional legitimate verification markers detected in the provided text.
              </p>
            ) : (
              <div className="space-y-2.5">
                {result.positive_signals.map((pos, i) => (
                  <div key={i} className="text-xs text-slate-800 bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-emerald-900 block mb-0.5">
                      ✓ {pos.signal}
                    </span>
                    <span className="text-slate-600 italic">"{pos.evidence}"</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verification Gaps Card */}
          <div
            id="verification-gaps-card"
            className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs"
          >
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <AlertCircle className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Unknowns & Verification Gaps
              </h4>
            </div>

            <p className="text-[11px] text-slate-500 mb-2">
              Distinguishing verified facts from unconfirmed claims:
            </p>

            <ul className="space-y-1.5">
              {result.verification_gaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700 leading-relaxed">
                  <span className="text-slate-400 mt-1">•</span>
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Prominent Required Disclaimer */}
          <div
            id="disclaimer-banner"
            className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-center text-xs text-slate-500 leading-relaxed flex items-center gap-2.5 justify-center"
          >
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="font-medium text-[11px]">
              {result.disclaimer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
