import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Globe,
  Mail,
  Briefcase,
  Upload,
  Sparkles,
  AlertCircle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Image as ImageIcon,
} from "lucide-react";

interface AnalysisInputFormProps {
  onAnalyze: (payload: {
    text: string;
    url?: string;
    sender?: string;
    title?: string;
    fileData?: { base64: string; mimeType: string; fileName: string };
  }) => void;
  onReset?: () => void;
  isLoading: boolean;
  initialText?: string;
  initialUrl?: string;
  initialSender?: string;
  initialTitle?: string;
}

export const AnalysisInputForm: React.FC<AnalysisInputFormProps> = ({
  onAnalyze,
  onReset,
  isLoading,
  initialText = "",
  initialUrl = "",
  initialSender = "",
  initialTitle = "",
}) => {
  const [text, setText] = useState<string>(initialText);
  const [url, setUrl] = useState<string>(initialUrl);
  const [sender, setSender] = useState<string>(initialSender);
  const [title, setTitle] = useState<string>(initialTitle);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileAttachment, setFileAttachment] = useState<{
    name: string;
    size: string;
    mimeType: string;
    base64?: string;
    isImage: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(initialText);
    setUrl(initialUrl);
    setSender(initialSender);
    setTitle(initialTitle);
    if (initialSender || initialTitle) {
      setShowAdvanced(true);
    }
  }, [initialText, initialUrl, initialSender, initialTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !url.trim() && !fileAttachment) {
      setErrorMessage("Please enter either the job offer / message text, provide a recruitment URL, or upload a document/screenshot.");
      return;
    }
    setErrorMessage(null);
    onAnalyze({
      text: text.trim(),
      url: url.trim() || undefined,
      sender: sender.trim() || undefined,
      title: title.trim() || undefined,
      fileData: fileAttachment?.base64
        ? {
            base64: fileAttachment.base64,
            mimeType: fileAttachment.mimeType,
            fileName: fileAttachment.name,
          }
        : undefined,
    });
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setErrorMessage(null);

    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const sizeStr =
      file.size < 1024 * 1024
        ? `${Math.round(file.size / 1024)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    if (isImage || isPdf) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          const base64Data = dataUrl.split(",")[1] || "";
          setFileAttachment({
            name: file.name,
            size: sizeStr,
            mimeType: file.type || (isPdf ? "application/pdf" : "image/png"),
            base64: base64Data,
            isImage,
          });
          if (!text.trim()) {
            setText(`[Attached Document / Screenshot: ${file.name} - Ready for Multimodal Vision & OCR inspection]`);
          }
          if (!title.trim()) {
            setTitle(file.name.replace(/\.[^/.]+$/, ""));
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Plain text, markdown, eml, json, etc.
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setText(content);
          setFileAttachment({
            name: file.name,
            size: sizeStr,
            mimeType: "text/plain",
            isImage: false,
          });
          if (!title.trim()) {
            setTitle(file.name.replace(/\.[^/.]+$/, ""));
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearAll = () => {
    setText("");
    setUrl("");
    setSender("");
    setTitle("");
    setFileAttachment(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onReset) {
      onReset();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id="scam-analysis-form">
      {/* Dual Input Grid: Primary Text Area + Primary URL Field */}
      <div className="space-y-3">
        {/* Recruitment URL Input (Clearly visible at the top) */}
        <div className="rounded-xl border border-slate-300 bg-white p-3 shadow-xs hover:border-slate-400 transition-colors focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900">
          <label htmlFor="input-recruitment-url" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              Recruitment URL / Career Portal (Optional or Direct URL Scan)
            </span>
            <span className="text-[11px] text-slate-400 font-normal lowercase">e.g. careers-apexglobal.xyz</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="input-recruitment-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Paste website, application portal link, or domain to inspect for lookalikes & phishing..."
              className="w-full text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-hidden font-normal"
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="text-xs text-slate-400 hover:text-slate-600 p-1"
                title="Clear URL"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Document / Message Text Area with Drag-and-Drop */}
        <div
          className={`relative rounded-2xl border transition-all ${
            isDragging
              ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-200"
              : "border-slate-300 bg-white hover:border-slate-400 focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900"
          } shadow-xs p-4`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="input-offer-text" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              Custom Job Offer, Appointment Letter, or Recruiter Message
            </label>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf,text/plain"
                className="hidden"
                id="file-upload-input"
              />
              <button
                type="button"
                id="btn-upload-file"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-md transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900 focus:outline-hidden"
                title="Upload image screenshot, PDF, or text file"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload File</span>
              </button>

              <button
                type="button"
                id="btn-clear-details"
                onClick={handleClearAll}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 focus:outline-hidden"
                title="Clear all fields and reset form"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-600" />
                <span>Clear Details</span>
              </button>
            </div>
          </div>

          {/* Active File Attachment Badge */}
          {fileAttachment && (
            <div className="mb-2.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
              {fileAttachment.isImage ? (
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span className="font-semibold truncate max-w-[200px]">{fileAttachment.name}</span>
              <span className="text-[10px] text-indigo-500">({fileAttachment.size})</span>
              {fileAttachment.isImage && (
                <span className="text-[10px] bg-indigo-200/80 text-indigo-800 font-medium px-1.5 py-0.5 rounded">
                  Vision & OCR Active
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setFileAttachment(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  if (text.startsWith("[Attached Document")) setText("");
                }}
                className="text-indigo-400 hover:text-red-600 p-0.5 rounded transition-colors cursor-pointer ml-1"
                title="Remove attached document"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <textarea
            id="input-offer-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Paste the full job offer letter, appointment notice, WhatsApp/Telegram recruiter chat, onboarding instructions, or email..."
            rows={6}
            className="w-full text-sm text-slate-900 placeholder:text-slate-400 bg-transparent resize-y focus:outline-hidden font-normal leading-relaxed"
          />

          {isDragging && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center pointer-events-none">
              <Upload className="w-8 h-8 text-amber-500 mb-2 animate-bounce" />
              <p className="text-sm font-semibold text-slate-800">Drop text or document file here</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            <span>{text.length} characters</span>
            <span>Includes payment demands, deadlines, banking instructions, or salary terms</span>
          </div>
        </div>
      </div>

      {/* Additional Optional Context (Sender & Title) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>{showAdvanced ? "Hide Sender & Job Title Details" : "+ Add Sender Channel & Position Title"}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          <span className="text-[11px] text-slate-400">Helps detect mismatched identities</span>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
            <div>
              <label htmlFor="input-sender-channel" className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" /> Sender Email / Channel
              </label>
              <input
                id="input-sender-channel"
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="e.g. hr-desk@apexglobal.xyz or Telegram"
                className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="input-claimed-title" className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-400" /> Claimed Title / Role
              </label>
              <input
                id="input-claimed-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Remote Data Specialist ($48/hr)"
                className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:border-slate-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Submit Button & Category Coverage Notice */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span>Scans Payment Traps, Urgency, Data Theft, Fake Domains & Lookalikes</span>
        </div>

        <button
          type="submit"
          id="btn-analyze-offer"
          disabled={isLoading}
          className="w-full sm:w-auto px-7 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-60 transition-all cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Analyzing Scam Indicators...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Analyze with ScamSniffer</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
