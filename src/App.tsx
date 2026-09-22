import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { AnalysisInputForm } from "./components/AnalysisInputForm";
import { AnalysisResults } from "./components/AnalysisResults";
import { SamplePicker } from "./components/SamplePicker";
import { HistoryModal } from "./components/HistoryModal";
import { SelfTestModal } from "./components/SelfTestModal";
import { ScamAnalysisResult, AnalysisHistoryItem, SampleCase } from "./types";
import { SAMPLE_CASES } from "./data/sampleCases";
import {
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Clock,
  Lock,
  Building2,
  Globe2,
  FileSearch,
  Sparkles,
  AlertTriangle,
  Zap,
  BookOpen,
  FlaskConical,
  KeyRound,
  AlertCircle,
} from "lucide-react";

const HISTORY_STORAGE_KEY = "scamsniffer_analysis_history";
const LEGACY_STORAGE_KEY = "scamshield_analysis_history";

export default function App() {
  const [result, setResult] = useState<ScamAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [modelUsed, setModelUsed] = useState<string>("");

  // Input state
  const [formData, setFormData] = useState<{
    text: string;
    url?: string;
    sender?: string;
    title?: string;
  }>({
    text: "",
    url: "",
    sender: "",
    title: "",
  });

  // History, Samples & Self-Test Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSamplesOpen, setIsSamplesOpen] = useState<boolean>(false);
  const [isSelfTestOpen, setIsSelfTestOpen] = useState<boolean>(false);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Check backend health & API key status
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.hasApiKey === "boolean") {
          setHasApiKey(data.hasApiKey);
        }
      })
      .catch(() => {});
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, []);

  const saveToHistory = (scanResult: ScamAnalysisResult, payload: { text: string; title?: string }) => {
    try {
      const newItem: AnalysisHistoryItem = {
        id: `scan-${Date.now()}`,
        timestamp: Date.now(),
        inputSnippet: payload.text.slice(0, 140) + (payload.text.length > 140 ? "..." : ""),
        title: payload.title || "Employment Document Analysis",
        result: scanResult,
      };
      const updated = [newItem, ...history].slice(0, 30);
      setHistory(updated);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  const handleAnalyze = async (payload: {
    text: string;
    url?: string;
    sender?: string;
    title?: string;
    fileData?: { base64: string; mimeType: string; fileName: string };
  }) => {
    setIsLoading(true);
    setError(null);
    setAnalysisStep("Querying ScamSniffer security analyst...");

    // Simulated progress steps for tactile feedback
    const stepTimer1 = setTimeout(() => {
      setAnalysisStep("Auditing payment traps & artificial urgency...");
    }, 700);

    const stepTimer2 = setTimeout(() => {
      setAnalysisStep("Checking sensitive data requests & domain risks...");
    }, 1500);

    const stepTimer3 = setTimeout(() => {
      setAnalysisStep("Synthesizing threat index and verification gaps...");
    }, 2400);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze document.");
      }

      setResult(data.result);
      if (data.modelUsed) {
        setModelUsed(data.modelUsed);
      }
      saveToHistory(data.result, payload);

      // Scroll smoothly to results
      setTimeout(() => {
        const resultsEl = document.getElementById("analysis-results-container");
        if (resultsEl) {
          resultsEl.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (err: any) {
      console.error("Analysis request failed:", err);
      setError(err.message || "An unexpected error occurred while communicating with ScamSniffer.");
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setIsLoading(false);
      setAnalysisStep("");
    }
  };

  const handleSelectSample = (sample: SampleCase, autoRun = false) => {
    setFormData({
      text: sample.text,
      url: sample.url || "",
      sender: sample.sender || "",
      title: sample.title,
    });
    setResult(null);
    setError(null);

    if (autoRun) {
      handleAnalyze({
        text: sample.text,
        url: sample.url,
        sender: sample.sender,
        title: sample.title,
      });
    } else {
      const formEl = document.getElementById("scam-analysis-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const handleSelectHistoryItem = (item: AnalysisHistoryItem) => {
    setResult(item.result);
    setFormData({
      text: item.result.risk_signals[0]?.evidence || item.inputSnippet,
      title: item.title,
    });
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setFormData({ text: "", url: "", sender: "", title: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-amber-100 selection:text-amber-900">
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSamples={() => setIsSamplesOpen(true)}
        onOpenSelfTest={() => setIsSelfTestOpen(true)}
        onReset={handleReset}
        historyCount={history.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* COMPACT TOP HEADER */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-400 text-xs font-bold tracking-wide">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                ScamSniffer
              </span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Powered by Gemini AI
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Recruitment Scam & Job Offer Inspector
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Inspect employment offers, appointment letters, recruiter WhatsApp/Telegram messages, and URLs for evidence-based fraud vectors.
            </p>
          </div>

          {/* Category coverage pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 font-medium">
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">Fee Demands</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">Urgency</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">Data Harvesting</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">Phishing URLs</span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">Domain Age</span>
          </div>
        </section>

        {/* HACKATHON EVALUATION & SYSTEM SELF-TEST BANNER */}
        <div
          id="system-self-test-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-indigo-950">Evaluation Ready:</span>
                <span className="text-xs font-semibold text-indigo-800">
                  Automated Test Suite & Deterministic Scoring Engine Active
                </span>
              </div>
              <p className="text-[11px] text-indigo-700/90 hidden md:block">
                Verifies weights (Payment +35, Sensitive +25, Urgency +15, Free Email +15), legitimate offer (&lt;25%), and scam offer (&ge;75%) benchmarks.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-trigger-self-test"
            onClick={() => setIsSelfTestOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer self-start sm:self-center"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Run System Self-Test</span>
          </button>
        </div>

        {/* Missing API Key Warning if detected via health check */}
        {hasApiKey === false && (
          <div
            id="missing-api-key-notice"
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 px-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 shadow-2xs"
          >
            <div className="flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Configuration Notice: GEMINI_API_KEY Required for Live Analysis</p>
                <p className="text-[11px] text-amber-800">
                  Set <code className="px-1 py-0.5 bg-amber-200/60 rounded font-mono">GEMINI_API_KEY</code> in <code className="px-1 py-0.5 bg-amber-200/60 rounded font-mono">.env</code> or AI Studio Secrets. Automated system self-test &amp; scoring benchmarks run fully offline.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSelfTestOpen(true)}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 shrink-0 cursor-pointer self-start sm:self-center"
            >
              Run Offline Tests &rarr;
            </button>
          </div>
        )}

        {/* MAIN CUSTOM TEXT / URL INPUT BOX (PROMINENTLY AT TOP) */}
        <section
          id="main-input-section"
          className="bg-white rounded-3xl p-5 sm:p-7 border-2 border-slate-300/90 shadow-sm relative"
        >
          {/* Quick preset chips above the input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Or Load Quick Sample:</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_CASES.slice(0, 4).map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample, false)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  title={sample.description}
                >
                  {sample.title.split("-")[0]?.trim() || sample.title}
                </button>
              ))}
            </div>
          </div>

          {/* The Analysis Input Form (Textarea & URL Field) */}
          <AnalysisInputForm
            onAnalyze={handleAnalyze}
            onReset={handleReset}
            isLoading={isLoading}
            initialText={formData.text}
            initialUrl={formData.url}
            initialSender={formData.sender}
            initialTitle={formData.title}
          />

          {/* Loading Indicator with Step Details */}
          {isLoading && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-800">
                <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                <span>{analysisStep || "Running ScamSniffer Security Analyst..."}</span>
              </div>
              <p className="text-xs text-slate-500">
                Evaluating against verified empirical evidence, fee traps, domain risk, and verification gaps.
              </p>
            </div>
          )}

          {/* Error Message with Model Fallback Alert */}
          {error && (
            <div
              id="analysis-error-card"
              className={`mt-4 p-4 rounded-xl border text-xs flex items-start gap-3 ${
                error.includes("GEMINI_API_KEY")
                  ? "bg-amber-50/95 border-amber-300 text-amber-900"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {error.includes("GEMINI_API_KEY") ? (
                <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1.5">
                <p className={`font-bold ${error.includes("GEMINI_API_KEY") ? "text-amber-950" : "text-red-800"}`}>
                  {error.includes("GEMINI_API_KEY") ? "API Key Configuration Notice" : "Analysis Failed"}
                </p>
                <p className="leading-relaxed">{error}</p>
                {error.includes("GEMINI_API_KEY") && (
                  <div className="p-2.5 bg-amber-100/70 rounded-lg text-[11px] text-amber-950 space-y-1">
                    <p className="font-semibold text-amber-900">How to configure:</p>
                    <p>1. Copy sample: <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[10px]">cp .env.example .env</code></p>
                    <p>2. Set key: <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[10px]">GEMINI_API_KEY: your_key_here</code></p>
                    <p>3. Or configure in Google AI Studio Settings &gt; Secrets.</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAnalyze(formData)}
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Retry Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSelfTestOpen(true)}
                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Run System Self-Test (Offline Mode)
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RESULTS SECTION (Rendered if analysis is complete) */}
        {result && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-slate-800" />
                <span>Security Analyst Intelligence Dossier</span>
              </h2>
              {modelUsed && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Engine: {modelUsed}
                </span>
              )}
            </div>

            <AnalysisResults result={result} onNewScan={handleReset} />
          </section>
        )}

        {/* SAMPLE SCENARIOS & FRAUD LIBRARY (BELOW INPUT BOX & RESULTS) */}
        <section
          id="sample-scenarios-section"
          className="bg-slate-100/70 rounded-3xl p-5 sm:p-7 border border-slate-200"
        >
          <SamplePicker onSelectSample={handleSelectSample} />
        </section>
      </main>

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistory={handleSelectHistoryItem}
        onClearHistory={handleClearHistory}
      />

      {/* Samples Modal */}
      {isSamplesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Select a Sample Scenario</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSamplesOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <SamplePicker onSelectSample={handleSelectSample} onClose={() => setIsSamplesOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Self-Test Evaluation Suite Modal */}
      <SelfTestModal
        isOpen={isSelfTestOpen}
        onClose={() => setIsSelfTestOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">ScamSniffer</span>
            <span>•</span>
            <span>Employment Fraud & Phishing Analyst</span>
            <span>•</span>
            <button
              type="button"
              id="footer-btn-self-test"
              onClick={() => setIsSelfTestOpen(true)}
              className="text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2 cursor-pointer"
            >
              System Self-Test Suite
            </button>
          </div>
          <p className="text-[11px] text-slate-400 max-w-md">
            This is an AI-assisted risk assessment, not a definitive determination of fraud. Always independently verify offers via official corporate channels.
          </p>
        </div>
      </footer>
    </div>
  );
}
