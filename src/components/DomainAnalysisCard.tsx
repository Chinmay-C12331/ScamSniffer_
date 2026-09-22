import React from "react";
import { DomainAnalysis } from "../types";
import { Globe, Calendar, ShieldCheck, AlertTriangle, HelpCircle, CheckCircle } from "lucide-react";

interface DomainAnalysisCardProps {
  analysis: DomainAnalysis;
}

export const DomainAnalysisCard: React.FC<DomainAnalysisCardProps> = ({ analysis }) => {
  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "High":
        return "bg-red-100 text-red-800 border-red-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getAgeStatusBadge = (status: string) => {
    switch (status) {
      case "Verified":
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "Unknown":
        return "text-amber-700 bg-amber-50 border-amber-200";
      default:
        return "text-slate-600 bg-slate-100 border-slate-200";
    }
  };

  return (
    <div id="domain-analysis-card" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Domain & URL Infrastructure Risk</h3>
            <p className="text-xs text-slate-500 font-mono break-all">
              {analysis.domain || "No direct URL/domain provided in input"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getRiskBadge(
              analysis.domain_risk
            )}`}
          >
            {analysis.domain_risk} Risk
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Domain Age & Verification Status */}
        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Domain Age
            </span>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded border ${getAgeStatusBadge(
                analysis.age_status
              )}`}
            >
              {analysis.age_status}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {analysis.domain_age || "Unable to verify"}
          </div>
        </div>

        {/* Infrastructure Risk Signal */}
        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Identity Match
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-200/60 text-slate-700">
              Observable
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {analysis.domain_risk === "High"
              ? "Lookalike / High Risk Vector"
              : analysis.domain_risk === "Low"
              ? "Authentic Enterprise Domain"
              : "Unverified / Third-Party Channel"}
          </div>
        </div>
      </div>

      {/* Observed Domain Evidence */}
      <div className="text-xs text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200/80">
        <span className="font-semibold text-slate-900 block mb-1">Observed Infrastructure Evidence:</span>
        <p className="leading-relaxed text-slate-700">
          {analysis.evidence || "No external domain indicators observed from provided text."}
        </p>
      </div>
    </div>
  );
};
