import React from "react";
import { RiskLevel } from "../types";
import { ShieldCheck, AlertTriangle, AlertOctagon, Flame, CheckCircle2 } from "lucide-react";

interface ThreatMeterProps {
  threatIndex: number; // 0 to 100
  riskLevel: RiskLevel;
  confidence: number;
  summary: string;
}

export const ThreatMeter: React.FC<ThreatMeterProps> = ({
  threatIndex,
  riskLevel,
  confidence,
  summary,
}) => {
  // Determine styling based on risk level and score
  const getTheme = () => {
    switch (riskLevel) {
      case "Critical":
        return {
          bg: "bg-red-50 border-red-200",
          badge: "bg-red-600 text-white",
          text: "text-red-700",
          meterColor: "#dc2626",
          icon: Flame,
          label: "Critical Threat Detected",
          borderRing: "border-red-500",
        };
      case "High":
        return {
          bg: "bg-orange-50 border-orange-200",
          badge: "bg-orange-600 text-white",
          text: "text-orange-700",
          meterColor: "#ea580c",
          icon: AlertOctagon,
          label: "High Risk Indicators",
          borderRing: "border-orange-500",
        };
      case "Medium":
        return {
          bg: "bg-amber-50 border-amber-200",
          badge: "bg-amber-600 text-white",
          text: "text-amber-700",
          meterColor: "#d97706",
          icon: AlertTriangle,
          label: "Medium Caution Advised",
          borderRing: "border-amber-500",
        };
      case "Low":
      default:
        return {
          bg: "bg-emerald-50 border-emerald-200",
          badge: "bg-emerald-600 text-white",
          text: "text-emerald-700",
          meterColor: "#059669",
          icon: CheckCircle2,
          label: "Low Risk Profile",
          borderRing: "border-emerald-500",
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.icon;

  // Arc calculation for threat gauge
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  // Use a 240 degree arc (approx 0.67 of circle)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (threatIndex / 100) * arcLength;

  return (
    <div
      id="threat-meter-card"
      role="region"
      aria-label="Threat Assessment Summary"
      className={`rounded-2xl border p-6 ${theme.bg} shadow-sm transition-all`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left side: Gauge & Badge */}
        <div className="flex items-center gap-6">
          {/* Radial meter with ARIA meter semantics */}
          <div
            className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center"
            role="meter"
            aria-valuenow={threatIndex}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Calculated Threat Index: ${threatIndex} out of 100`}
          >
            <svg
              className="w-full h-full -rotate-90 transform"
              viewBox="0 0 140 140"
              aria-hidden="true"
              focusable="false"
            >
              {/* Background circle track */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                className="stroke-slate-200"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeLinecap="round"
              />
              {/* Value stroke */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke={theme.meterColor}
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {threatIndex}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Threat Index
              </span>
            </div>
          </div>

          {/* Level details */}
          <div>
            <div className="flex items-center gap-2 mb-1.5" aria-live="polite">
              <span
                id="badge-risk-level"
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${theme.badge} shadow-xs`}
              >
                <IconComponent className="w-3.5 h-3.5" aria-hidden="true" />
                {riskLevel} Risk
              </span>
              <span
                id="badge-confidence"
                className="text-xs font-semibold text-slate-600 bg-white/80 px-2.5 py-1 rounded-full border border-slate-200/80"
              >
                {confidence}% Confidence
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {theme.label}
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-sm">
              Assessed strictly against verified empirical evidence and behavioral scam vectors.
            </p>
          </div>
        </div>

        {/* Right side: Executive Summary */}
        <div
          className="flex-1 lg:max-w-xl bg-white/90 rounded-xl p-4 border border-slate-200 shadow-xs"
          aria-live="polite"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Analyst Executive Summary
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Evidence-Based</span>
          </div>
          <p id="threat-summary-text" className="text-sm leading-relaxed text-slate-800">
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
};
