export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type Severity = "Low" | "Medium" | "High";
export type AgeStatus = "Verified" | "Unknown" | "Not Applicable";
export type DomainRisk = "Low" | "Medium" | "High" | "Unknown";

export interface RiskSignal {
  category: string;
  severity: Severity;
  evidence: string;
  impact: string;
}

export interface PositiveSignal {
  signal: string;
  evidence: string;
}

export interface DomainAnalysis {
  domain: string;
  domain_age: string;
  age_status: AgeStatus;
  domain_risk: DomainRisk;
  evidence: string;
}

export interface ScamAnalysisResult {
  threat_index: number; // 0 to 100
  risk_level: RiskLevel;
  summary: string;
  risk_signals: RiskSignal[];
  positive_signals: PositiveSignal[];
  verification_gaps: string[];
  domain_analysis: DomainAnalysis;
  recommended_actions: string[];
  confidence: number;
  disclaimer: string;
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: number;
  inputSnippet: string;
  title?: string;
  result: ScamAnalysisResult;
}

export interface SampleCase {
  id: string;
  title: string;
  badge: string;
  category: string;
  riskPreview: RiskLevel;
  sender?: string;
  url?: string;
  text: string;
  description: string;
}

export interface TestCaseResult {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  details: string;
  score?: number;
  riskLevel?: string;
  durationMs: number;
  error?: string;
}

export interface TestSuiteResponse {
  success: boolean;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  totalDurationMs: number;
  suites: TestCaseResult[];
}
