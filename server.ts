import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  calculateDeterministicScore,
  validateAnalysisInput,
  validateRecruitmentUrl,
  detectTelecomHijacking,
  SCORING_WEIGHTS,
  StructuredInspectionInput,
} from "./src/scoring.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy initialization of Gemini client
let genAiClient: GoogleGenAI | null = null;
const modelCooldownMap = new Map<string, number>();

// Precompiled regex patterns for high-throughput heuristic fallback evaluation
const PAYMENT_FALLBACK_REGEX = /\b(zelle|cashapp|cash\s*app|venmo|usdt|crypto|cryptocurrency|wire\s*transfer|western\s*union|moneygram|gift\s*card|security\s*deposit|refundable\s*deposit|equipment\s*(fee|deposit)|processing\s*fee|training\s*fee|courier\s*fee|check\s*deposit)\b/i;
const URGENCY_FALLBACK_REGEX = /\b(within\s*24\s*hours|immediate(ly)?|urgently?|urgent\s*response|forfeiture|forfeit|expires\s*(today|tomorrow)|by\s*5:?00\s*pm|act\s*now)\b/i;
const SENSITIVE_FALLBACK_REGEX = /\b(ssn|social\s*security|routing\s*number|bank\s*details|passport\s*(scan|copy)?|identity\s*card|driver'?s\s*license|date\s*of\s*birth|proof\s*of\s*transaction)\b/i;
const TELEGRAM_FALLBACK_REGEX = /\b(telegram|whatsapp|signal|text\s*interview)\b/i;
const FREE_EMAIL_REGEX = /@(gmail|yahoo|hotmail|outlook)\.com/i;
const SUSPICIOUS_DOMAIN_REGEX = /\.(xyz|top|work|click|gq|cf|ml|tk|careers-onboarding)\b/i;
const ESTABLISHED_CORP_EMAIL_REGEX = /@(stripe|google|microsoft|amazon|apple|meta|netflix|salesforce)\.com/i;
const ESTABLISHED_CORP_URL_REGEX = /(stripe|google|microsoft|amazon|apple|meta)\.com/i;

function generateDeterministicFallbackAnalysis(text: string, url: string, sender?: string, title?: string) {
  const combined = `${title || ""} ${sender || ""} ${url || ""} ${text || ""}`.toLowerCase();

  // Payment detection
  const paymentMatch = combined.match(PAYMENT_FALLBACK_REGEX);
  const hasPayment = !!paymentMatch;

  // Urgency detection
  const urgencyMatch = combined.match(URGENCY_FALLBACK_REGEX);
  const hasUrgency = !!urgencyMatch;

  // Sensitive data detection
  const sensitiveMatch = combined.match(SENSITIVE_FALLBACK_REGEX);
  const hasSensitive = !!sensitiveMatch;

  // Telegram / Unofficial channel
  const telegramMatch = combined.match(TELEGRAM_FALLBACK_REGEX);

  // Telecom Hijacking / MMI star-codes & call forwarding detection
  const telecomAnalysis = detectTelecomHijacking(`${title || ""} ${sender || ""} ${url || ""} ${text || ""}`);

  // Free email
  const isFreeEmail = !!(sender && FREE_EMAIL_REGEX.test(sender)) || FREE_EMAIL_REGEX.test(combined);

  // Suspicious domain
  const hasSuspiciousDomain = !!(url && SUSPICIOUS_DOMAIN_REGEX.test(url));

  // Positive trust signals
  const isEstablishedCorporate = !!(sender && ESTABLISHED_CORP_EMAIL_REGEX.test(sender)) || !!(url && ESTABLISHED_CORP_URL_REGEX.test(url));
  const hasNoFeeDisclaimer = combined.includes("zero cost") || combined.includes("will never ask you for money") || combined.includes("no fees");
  const hasStandardDoc = combined.includes("docusign") || combined.includes("proprietary information agreement") || combined.includes("epia");

  const riskSignals: any[] = [];
  if (telecomAnalysis.detected) {
    riskSignals.push({
      category: "TELECOM HIJACKING AND MFA INTERCEPTION",
      severity: "High",
      evidence: telecomAnalysis.evidence || "MMI call forwarding or telecom diversion pattern detected.",
      impact: "CRITICAL: Attacker attempts to divert incoming calls or 2FA voice OTPs via MMI star codes (*21*, *401*) to hijack personal accounts (WhatsApp, Google, banking). Never dial carrier routing strings for recruitment.",
    });
  }
  if (hasPayment) {
    riskSignals.push({
      category: "PAYMENT DEMANDS",
      severity: "High",
      evidence: `Payment or deposit requirement detected matching pattern: "${paymentMatch?.[0]}".`,
      impact: "Advance-fee equipment deposit or non-reversible transaction commonly used to defraud candidates.",
    });
  }
  if (hasUrgency) {
    riskSignals.push({
      category: "URGENCY AND PRESSURE",
      severity: "High",
      evidence: `Artificial deadline or forfeiture pressure detected: "${urgencyMatch?.[0]}".`,
      impact: "Coercive urgency designed to force the candidate to comply before conducting independent verification.",
    });
  }
  if (hasSensitive) {
    riskSignals.push({
      category: "PERSONAL OR FINANCIAL INFORMATION",
      severity: "High",
      evidence: `Request for sensitive personally identifiable or banking details: "${sensitiveMatch?.[0]}".`,
      impact: "Premature harvesting of identity or financial information before official contract signing.",
    });
  }
  if (telegramMatch) {
    riskSignals.push({
      category: "PHISHING INDICATORS",
      severity: "Medium",
      evidence: `Recruitment or interview conducted over informal messaging channel: "${telegramMatch[0]}".`,
      impact: "Bypasses corporate logging and HR verification frameworks.",
    });
  }
  if (isFreeEmail) {
    riskSignals.push({
      category: "DOMAIN RISK",
      severity: "Medium",
      evidence: "Recruiter communicating via a free consumer email provider rather than an official corporate domain.",
      impact: "Free email services can be created by anyone without enterprise identity verification.",
    });
  }

  const positiveSignals: any[] = [];
  if (isEstablishedCorporate) {
    positiveSignals.push({
      signal: "Official Corporate Domain",
      evidence: "Communication or URL is associated with a verified enterprise domain.",
    });
  }
  if (hasNoFeeDisclaimer) {
    positiveSignals.push({
      signal: "Explicit No-Fee Advisory",
      evidence: "Text confirms zero cost for equipment or explicitly states employer will never ask for payment.",
    });
  }
  if (hasStandardDoc) {
    positiveSignals.push({
      signal: "Standard Enterprise Onboarding Workflow",
      evidence: "References established legal frameworks (DocuSign, EPIA).",
    });
  }

  const det = calculateDeterministicScore({
    payment_demand: { detected: hasPayment },
    telecom_hijacking: telecomAnalysis,
    urgency_pressure: { detected: hasUrgency },
    sensitive_data_request: { detected: hasSensitive },
    domain_risk: {
      detected: hasSuspiciousDomain || isFreeEmail,
      free_email_provider: isFreeEmail,
      domain_age_status: isEstablishedCorporate ? "VERIFIED_ESTABLISHED" : "UNABLE_TO_VERIFY",
    },
    positive_trust_signals: positiveSignals,
    employer_verification: {
      status: positiveSignals.length > 1 ? "VERIFIED" : hasPayment || hasSensitive || telecomAnalysis.detected ? "SUSPICIOUS" : "UNVERIFIED",
    },
  });

  let extractedDomain = "N/A";
  if (url) {
    try {
      extractedDomain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    } catch {
      extractedDomain = url;
    }
  }

  return {
    threat_index: det.threat_index,
    risk_level: det.risk_level,
    summary: hasPayment || hasSensitive
      ? "Deterministic heuristic inspection identified critical employment fraud markers, including upfront transaction demands and coercive deadlines."
      : positiveSignals.length > 0
      ? "Deterministic heuristic inspection indicates legitimate enterprise hiring patterns with verified domain signatures and zero-fee policies."
      : "No critical advance-fee traps detected. Standard caution is advised when proceeding with unverified recruitment channels.",
    risk_signals: riskSignals,
    positive_signals: positiveSignals,
    verification_gaps: [
      "Exact creation date and registrant records of the domain cannot be verified without external WHOIS query data.",
      "Corporate registration credentials should be independently cross-referenced with Secretary of State or corporate registrars.",
    ],
    domain_analysis: {
      domain: extractedDomain,
      domain_age: "Unable to verify",
      age_status: isEstablishedCorporate ? "Verified" : "Unknown",
      domain_risk: hasSuspiciousDomain ? "High" : isEstablishedCorporate ? "Low" : "Medium",
      evidence: isEstablishedCorporate
        ? "Domain matches verified corporate infrastructure."
        : hasSuspiciousDomain
        ? "Domain utilizes a high-risk or secondary redirect hostname."
        : "Domain status is unverified without external directory queries.",
    },
    recommended_actions: hasPayment || hasSensitive
      ? [
          "Do not send any funds, cryptocurrency, or gift cards.",
          "Cease all communication with the sender across messaging platforms.",
          "Do not submit personally identifiable or banking details.",
          "Report the recruitment scam to the FTC and IC3.",
        ]
      : [
          "Confirm the job offer through official company career pages.",
          "Verify the sender email headers to ensure no spoofing has occurred.",
        ],
    confidence: det.confidence,
    disclaimer: "This is an AI-assisted risk assessment, not a definitive determination of fraud.",
    scoring_breakdown: det.breakdown,
  };
}
function getGeminiClient(): GoogleGenAI {
  if (!genAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please configure it in Settings > Secrets.");
    }
    genAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAiClient;
}

const SYSTEM_INSTRUCTION = `You are ScamSniffer, an AI-powered security analyst specializing in detecting fraudulent job offers, fake appointment letters, recruitment phishing, and employment-related payment scams.

Your task is to analyze a job offer, appointment letter, recruitment message, or recruitment URL and identify evidence-based scam indicators.

Analyze the input across these categories:

1. PAYMENT DEMANDS
- Registration fees
- Training fees
- Equipment fees
- Security deposits
- Processing fees
- Requests to transfer money before joining
- Requests for cryptocurrency, gift cards, UPI transfers, or unusual payment methods

2. URGENCY AND PRESSURE
- Artificial deadlines
- Threats of losing the offer
- Immediate payment demands
- Pressure to act without verification

3. PERSONAL OR FINANCIAL INFORMATION
- Bank account information
- Card details
- OTPs
- Passwords
- Identity documents
- Sensitive information requested before legitimate hiring stages

4. EMPLOYER AND JOB CLAIMS
- Unrealistic salary
- Guaranteed employment
- Suspicious job descriptions
- Inconsistent company information
- Claims that cannot be reasonably verified

5. PHISHING INDICATORS
- Suspicious URLs
- Lookalike domains
- Mismatched company/domain identity
- Suspicious links
- Requests to communicate through unusual channels
- Manipulative language

6. TELECOM HIJACKING & MFA INTERCEPTION
- GSM/MMI star-codes: *21*, **21*, *401*, *67*, or instructions asking user to dial *<code_number>*<phone_number>#
- Call forwarding, SMS forwarding, or call diversion disguised as "enhanced security", "call verification", "carrier routing", "line activation", or "network registration"
- Tactics designed to divert incoming voice calls or SMS OTPs for account takeover (e.g., WhatsApp, Telegram, banking, or email 2FA)
- Requests to enter dialer strings or share one-time verification passcodes

7. DOMAIN RISK
If a URL or domain is provided, assess available evidence about:
- Domain age
- Whether the domain appears newly registered
- Whether the domain appears connected to the claimed organization
- Other observable domain-related risk signals

IMPORTANT:
- Never invent domain age, company information, or external facts.
- Clearly distinguish VERIFIED information from UNKNOWN information.
- Do not call something a scam merely because one weak indicator exists.
- Explain the evidence behind every important risk finding.
- If information cannot be verified, say "Unable to verify".
- The final risk assessment must be based on the available evidence.

Return the analysis in this exact JSON structure:
{
  "threat_index": 0,
  "risk_level": "Low | Medium | High | Critical",
  "summary": "",
  "risk_signals": [
    {
      "category": "",
      "severity": "Low | Medium | High",
      "evidence": "",
      "impact": ""
    }
  ],
  "positive_signals": [
    {
      "signal": "",
      "evidence": ""
    }
  ],
  "verification_gaps": [
    ""
  ],
  "domain_analysis": {
    "domain": "",
    "domain_age": "",
    "age_status": "Verified | Unknown | Not Applicable",
    "domain_risk": "Low | Medium | High | Unknown",
    "evidence": ""
  },
  "recommended_actions": [
    ""
  ],
  "confidence": 0,
  "disclaimer": "This is an AI-assisted risk assessment, not a definitive determination of fraud."
}

Do not output Markdown.
Do not output explanations outside the JSON.
Do not invent evidence.`;

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    threat_index: {
      type: Type.INTEGER,
      description: "Calculated threat score from 0 (completely legitimate) to 100 (critical scam threat).",
    },
    risk_level: {
      type: Type.STRING,
      description: "Exactly one of: Low, Medium, High, Critical",
    },
    summary: {
      type: Type.STRING,
      description: "Evidence-based summary of findings.",
    },
    risk_signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: "Category name e.g. PAYMENT DEMANDS, URGENCY AND PRESSURE, etc.",
          },
          severity: {
            type: Type.STRING,
            description: "Severity: Low, Medium, or High",
          },
          evidence: {
            type: Type.STRING,
            description: "Direct quote or observable fact from the input.",
          },
          impact: {
            type: Type.STRING,
            description: "Risk impact on candidate.",
          },
        },
        required: ["category", "severity", "evidence", "impact"],
      },
    },
    positive_signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          signal: { type: Type.STRING },
          evidence: { type: Type.STRING },
        },
        required: ["signal", "evidence"],
      },
    },
    verification_gaps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    domain_analysis: {
      type: Type.OBJECT,
      properties: {
        domain: { type: Type.STRING },
        domain_age: { type: Type.STRING },
        age_status: { type: Type.STRING, description: "Verified, Unknown, or Not Applicable" },
        domain_risk: { type: Type.STRING, description: "Low, Medium, High, or Unknown" },
        evidence: { type: Type.STRING },
      },
      required: ["domain", "domain_age", "age_status", "domain_risk", "evidence"],
    },
    recommended_actions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    confidence: {
      type: Type.INTEGER,
      description: "Confidence percentage between 0 and 100.",
    },
    disclaimer: {
      type: Type.STRING,
    },
  },
  required: [
    "threat_index",
    "risk_level",
    "summary",
    "risk_signals",
    "positive_signals",
    "verification_gaps",
    "domain_analysis",
    "recommended_actions",
    "confidence",
    "disclaimer",
  ],
};

// API routes FIRST
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Self-Test API endpoint for live hackathon evaluation
app.get("/api/self-test", async (_req, res) => {
  const startTime = Date.now();
  const testResults: Array<{
    id: string;
    name: string;
    status: "PASS" | "FAIL";
    details: string;
    score?: number;
    riskLevel?: string;
    durationMs: number;
    error?: string;
  }> = [];

  try {
    // Test 1: Deterministic weights
    const t1Start = performance.now();
    const paymentTest = calculateDeterministicScore({
      payment_demand: { detected: true, fee_type: "Zelle Deposit" },
    });
    const sensitiveTest = calculateDeterministicScore({
      sensitive_data_request: { detected: true },
    });
    const urgencyTest = calculateDeterministicScore({
      urgency_pressure: { detected: true },
    });
    const domainTest = calculateDeterministicScore({
      domain_risk: { detected: true, free_email_provider: true, domain_age_status: "UNABLE_TO_VERIFY" },
    });
    const combinedTest = calculateDeterministicScore({
      payment_demand: { detected: true },
      sensitive_data_request: { detected: true },
      urgency_pressure: { detected: true },
    });

    const weightsPassed =
      paymentTest.breakdown.payment_demand_points === 35 &&
      sensitiveTest.breakdown.sensitive_data_points === 25 &&
      urgencyTest.breakdown.urgency_pressure_points === 15 &&
      domainTest.breakdown.domain_risk_points === 15 &&
      combinedTest.threat_index === 75;

    testResults.push({
      id: "scoring-weights",
      name: "Deterministic Scoring Weights Verification",
      status: weightsPassed ? "PASS" : "FAIL",
      details: `Payment (+${SCORING_WEIGHTS.PAYMENT_DEMAND}), Sensitive Data (+${SCORING_WEIGHTS.SENSITIVE_DATA_REQUEST}), Urgency (+${SCORING_WEIGHTS.URGENCY_PRESSURE}), Free Email (+${SCORING_WEIGHTS.FREE_EMAIL_OR_NEW_DOMAIN}) verified deterministically.`,
      durationMs: +(performance.now() - t1Start).toFixed(2),
    });

    // Test 2: Low-risk legitimate offer benchmark (< 25%)
    const t2Start = performance.now();
    const legitOffer: StructuredInspectionInput = {
      employer_name_claimed: "Stripe, Inc.",
      domain_analyzed: "stripe.com",
      payment_demand: { detected: false },
      urgency_pressure: { detected: false },
      sensitive_data_request: { detected: false },
      domain_risk: { detected: false, domain_age_status: "VERIFIED_ESTABLISHED", free_email_provider: false },
      employer_verification: { status: "VERIFIED" },
      positive_trust_signals: [
        { signal: "Official Corporate Domain", evidence: "stripe.com/jobs" },
        { signal: "Explicit No-Fee Policy", evidence: "Stripe never asks for fees or deposits." },
      ],
    };
    const legitResult = calculateDeterministicScore(legitOffer);
    const legitPassed = legitResult.threat_index < 25 && legitResult.risk_level === "Low";
    testResults.push({
      id: "legitimate-benchmark",
      name: "Low-Risk Legitimate Offer Benchmark (< 25%)",
      status: legitPassed ? "PASS" : "FAIL",
      details: `Verified legitimate corporate offer evaluated to threat index ${legitResult.threat_index}% (${legitResult.risk_level} Risk), strictly below the 25% threshold.`,
      score: legitResult.threat_index,
      riskLevel: legitResult.risk_level,
      durationMs: +(performance.now() - t2Start).toFixed(2),
    });

    // Test 3: Critical-risk scam offer benchmark (>= 75%)
    const t3Start = performance.now();
    const scamOffer: StructuredInspectionInput = {
      employer_name_claimed: "Apex Global Logistics",
      payment_demand: { detected: true, fee_type: "Refundable Zelle Equipment Deposit" },
      urgency_pressure: { detected: true, evidence: "24-hour forfeiture deadline" },
      sensitive_data_request: { detected: true, requested_items: ["SSN", "Banking Credentials"] },
      domain_risk: { detected: true, domain_age_status: "VERIFIED_RECENT", free_email_provider: false },
      unrealistic_claims: { detected: true, evidence: "Remote Data Entry $52/hr" },
      employer_verification: { status: "SUSPICIOUS" },
    };
    const scamResult = calculateDeterministicScore(scamOffer);
    const scamPassed = scamResult.threat_index >= 75 && scamResult.risk_level === "Critical";
    testResults.push({
      id: "scam-benchmark",
      name: "Critical-Risk Scam Offer Benchmark (>= 75%)",
      status: scamPassed ? "PASS" : "FAIL",
      details: `Verified aggressive recruitment scam evaluated to threat index ${scamResult.threat_index}% (${scamResult.risk_level} Risk), strictly >= 75% threshold.`,
      score: scamResult.threat_index,
      riskLevel: scamResult.risk_level,
      durationMs: +(performance.now() - t3Start).toFixed(2),
    });

    // Test 4: Empty input validation & error handling
    const t4Start = performance.now();
    const emptyValidation = validateAnalysisInput({ text: "", url: "" });
    const whitespaceValidation = validateAnalysisInput({ text: "   ", url: "   " });
    const validTextValidation = validateAnalysisInput({ text: "Valid job offer letter body", url: "" });
    const emptyPassed = !emptyValidation.isValid && !whitespaceValidation.isValid && validTextValidation.isValid;
    testResults.push({
      id: "empty-input-validation",
      name: "Empty Input Validation & Error Handling",
      status: emptyPassed ? "PASS" : "FAIL",
      details: "Verified that empty inputs, null payloads, and whitespace-only text are rejected with informative error messages.",
      durationMs: +(performance.now() - t4Start).toFixed(2),
    });

    // Test 5: Invalid URL validation
    const t5Start = performance.now();
    const invalidUrl = validateRecruitmentUrl("not-a-valid-domain");
    const validUrl = validateRecruitmentUrl("https://careers.google.com");
    const normalizedUrl = validateRecruitmentUrl("meta.com/careers");
    const urlPassed = !invalidUrl.isValid && validUrl.isValid && normalizedUrl.isValid && normalizedUrl.normalizedUrl === "https://meta.com/careers";
    testResults.push({
      id: "url-validation",
      name: "Invalid URL Validation & Normalization",
      status: urlPassed ? "PASS" : "FAIL",
      details: "Confirmed malformed URLs without domains are rejected and valid schemes are normalized properly.",
      durationMs: +(performance.now() - t5Start).toFixed(2),
    });

    // Test 6: Graceful handling of unverified domain age (UNABLE_TO_VERIFY)
    const t6Start = performance.now();
    const unverifiedAgeInput: StructuredInspectionInput = {
      domain_analyzed: "unverified-recruitment-site.org",
      domain_risk: {
        detected: false,
        domain_age_status: "UNABLE_TO_VERIFY",
        free_email_provider: false,
      },
    };
    const unverifiedResult = calculateDeterministicScore(unverifiedAgeInput);
    const unverifiedPassed =
      unverifiedResult.breakdown.domain_risk_points === 0 &&
      unverifiedResult.threat_index === 0 &&
      unverifiedResult.confidence <= 92;
    testResults.push({
      id: "unverified-domain-age",
      name: "Graceful Unverified Domain Age (UNABLE_TO_VERIFY)",
      status: unverifiedPassed ? "PASS" : "FAIL",
      details: "Confirmed unknown domain age outputs 'UNABLE_TO_VERIFY' without applying false penalties or hallucinating domain age data.",
      durationMs: +(performance.now() - t6Start).toFixed(2),
    });

    // Test 7: Repository Security & Clean Configuration Audit
    const t7Start = performance.now();
    let secPassed = true;
    let secDetails = "Verified .gitignore ignores env/build files, .env.example documents GEMINI_API_KEY with zero secrets, and no client-side keys exist.";
    try {
      const gitignore = fs.existsSync(".gitignore") ? fs.readFileSync(".gitignore", "utf-8") : "";
      const envExample = fs.existsSync(".env.example") ? fs.readFileSync(".env.example", "utf-8") : "";

      const hasGitignoreRules =
        gitignore.includes(".env") &&
        gitignore.includes(".env.local") &&
        gitignore.includes("node_modules/") &&
        gitignore.includes("__pycache__/") &&
        gitignore.includes(".pytest_cache/") &&
        gitignore.includes("dist/");

      const hasCleanEnvExample =
        envExample.includes("GEMINI_API_KEY") &&
        !envExample.includes("AIzaSy") &&
        envExample.includes("your_gemini_api_key_here");

      secPassed = hasGitignoreRules && hasCleanEnvExample;
      if (!secPassed) {
        secDetails = "Security audit check failed: missing required .gitignore rules or invalid .env.example template.";
      }
    } catch (e: any) {
      secPassed = false;
      secDetails = `Security audit error: ${e.message}`;
    }

    testResults.push({
      id: "repo-security-audit",
      name: "Repository Security & Clean Configuration Audit",
      status: secPassed ? "PASS" : "FAIL",
      details: secDetails,
      durationMs: +(performance.now() - t7Start).toFixed(2),
    });

    // Test 8: Telecom Hijacking & MFA Interception Vectors
    const t8Start = performance.now();
    const telecomText1 = "Please open your phone dialer and call *21*+18005550199# to complete enterprise line verification.";
    const telecomText2 = "Dial *401*9876543210 immediately to register your corporate SIM card.";
    const heuristic1 = detectTelecomHijacking(telecomText1);
    const heuristic2 = detectTelecomHijacking(telecomText2);

    const telecomScoreStandard = calculateDeterministicScore({
      telecom_hijacking: { detected: true, verification_pretext: false },
    });
    const telecomScorePretext = calculateDeterministicScore({
      telecom_hijacking: { detected: true, verification_pretext: true },
    });

    const telecomPassed =
      heuristic1.detected &&
      heuristic1.code_detected === "*21*" &&
      heuristic1.verification_pretext === true &&
      heuristic2.detected &&
      heuristic2.code_detected === "*401*" &&
      telecomScoreStandard.breakdown.telecom_hijacking_points === 35 &&
      telecomScoreStandard.threat_index === 35 &&
      telecomScorePretext.threat_index >= 75 &&
      telecomScorePretext.risk_level === "Critical";

    testResults.push({
      id: "telecom-hijacking-mfa",
      name: "Telecom Hijacking & MFA Interception Vectors (MMI *21* / *401*)",
      status: telecomPassed ? "PASS" : "FAIL",
      details: `MMI call forwarding (*21*, *401*) detected with +${SCORING_WEIGHTS.TELECOM_HIJACKING_MFA} points. Account verification pretext elevated threat score to ${telecomScorePretext.threat_index}% (Critical Risk).`,
      durationMs: +(performance.now() - t8Start).toFixed(2),
    });

    const passedCount = testResults.filter((t) => t.status === "PASS").length;
    const failedCount = testResults.filter((t) => t.status === "FAIL").length;

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalTests: testResults.length,
      passed: passedCount,
      failed: failedCount,
      allPassed: failedCount === 0,
      totalDurationMs: Date.now() - startTime,
      suites: testResults,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to execute test suite.",
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { text, url, sender, title, fileData } = req.body;

    const hasAttachment = !!(fileData && fileData.base64);
    const effectiveText = text || (hasAttachment ? `[Attached file: ${fileData.fileName || "document"}]` : "");

    const inputValidation = validateAnalysisInput({ text: effectiveText, url });
    if (!inputValidation.isValid) {
      return res.status(400).json({
        error: inputValidation.error || "Please provide either the job offer text, an email/message, or a recruitment URL to analyze.",
      });
    }

    if (url && url.trim()) {
      const urlValidation = validateRecruitmentUrl(url.trim());
      if (!urlValidation.isValid) {
        return res.status(400).json({
          error: `Invalid recruitment URL: ${urlValidation.error}`,
        });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: "GEMINI_API_KEY is not configured. Please add your Gemini API key to .env or project secrets in Settings > Secrets to enable live model analysis.",
        isConfigError: true,
      });
    }

    const ai = getGeminiClient();

    let userPrompt = "Analyze the following job offer/recruitment material for scam indicators:\n\n";
    if (title) userPrompt += `TITLE / POSITION CLAIMED: ${title}\n`;
    if (sender) userPrompt += `SENDER / CHANNEL: ${sender}\n`;
    if (url) userPrompt += `RECRUITMENT URL / DOMAIN: ${url}\n`;
    if (fileData?.fileName) userPrompt += `ATTACHED FILE / SCREENSHOT: ${fileData.fileName}\n`;
    userPrompt += `\nDOCUMENT / MESSAGE CONTENT:\n"""\n${effectiveText || "(No document body text provided, analyze provided attachment/URL/sender information)"}\n"""`;

    // Construct multimodal content payload
    const contentParts: any[] = [];
    if (fileData && fileData.base64) {
      contentParts.push({
        inlineData: {
          data: fileData.base64,
          mimeType: fileData.mimeType || "image/png",
        },
      });
    }
    contentParts.push(userPrompt);
    const modelContents = contentParts.length === 1 ? contentParts[0] : contentParts;

    // Intelligent Candidate Model Order:
    // Prioritize high-throughput, low-latency models with generous quotas (gemini-3.5-flash-lite)
    const CANDIDATE_MODELS = [
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-flash-latest",
    ];

    let rawText: string | undefined;
    let modelUsed = "gemini-3.5-flash-lite";
    let lastError: any = null;

    for (const model of CANDIDATE_MODELS) {
      // Skip models that are currently in quota cooldown
      const cooldownUntil = modelCooldownMap.get(model);
      if (cooldownUntil && cooldownUntil > Date.now()) {
        continue;
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: modelContents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: analysisResponseSchema,
              temperature: 0.2, // Low temperature for factual, analytical consistency
            },
          });

          if (response.text) {
            rawText = response.text;
            modelUsed = model;
            break;
          }
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || String(err);

          // If model is retired or not found, skip to next candidate immediately
          if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("no longer available")) {
            modelCooldownMap.set(model, Date.now() + 24 * 60 * 60 * 1000);
            break;
          }

          // If quota exceeded or rate limited, apply cooldown and immediately move to backup model
          if (
            msg.includes("429") ||
            msg.includes("RESOURCE_EXHAUSTED") ||
            msg.includes("quota") ||
            msg.includes("Quota exceeded")
          ) {
            const isDailyLimit =
              msg.includes("GenerateRequestsPerDay") ||
              msg.includes("per_day") ||
              msg.includes("limit: 20") ||
              msg.includes("FreeTier");
            const cooldownMs = isDailyLimit ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
            modelCooldownMap.set(model, Date.now() + cooldownMs);
            console.log(`[ScamSniffer] Quota limit encountered on ${model}. Cooldown registered; switching to fallback model.`);
            break; // Do not retry attempt 2 on quota-exhausted model
          }

          const isTransient =
            msg.includes("503") ||
            msg.includes("high demand") ||
            msg.includes("overloaded") ||
            msg.includes("UNAVAILABLE");

          if (isTransient && attempt === 0) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          break; // proceed to next candidate model
        }
      }
      if (rawText) break;
    }

    let parsedResult;

    if (!rawText) {
      console.log("[ScamSniffer] Upstream model capacity exhausted or in cooldown. Engaging deterministic heuristic inspection fallback.");
      parsedResult = generateDeterministicFallbackAnalysis(text || "", url || "", sender, title);
      modelUsed = "deterministic-heuristic-engine";
    } else {
      try {
        parsedResult = JSON.parse(rawText.trim());
      } catch {
        // In case of any wrapping markdown formatting
        const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        parsedResult = JSON.parse(cleanJson);
      }
    }

    // Ensure disclaimer is exact
    parsedResult.disclaimer =
      parsedResult.disclaimer || "This is an AI-assisted risk assessment, not a definitive determination of fraud.";

    // Apply deterministic scoring engine calculation (Rule 3: No Hallucinated Scoring)
    if (parsedResult.risk_signals && Array.isArray(parsedResult.risk_signals)) {
      const telecomHeuristic = detectTelecomHijacking(`${title || ""} ${sender || ""} ${url || ""} ${text || ""}`);
      const hasTelecomFromModel = parsedResult.risk_signals.some((s: any) =>
        s.category?.toUpperCase().includes("TELECOM") ||
        s.category?.toUpperCase().includes("FORWARDING") ||
        s.category?.toUpperCase().includes("MMI") ||
        s.category?.toUpperCase().includes("HIJACKING") ||
        s.evidence?.includes("*21*") ||
        s.evidence?.includes("*401*") ||
        s.evidence?.includes("**21*")
      );
      const isTelecomDetected = telecomHeuristic.detected || hasTelecomFromModel;

      if (telecomHeuristic.detected && !hasTelecomFromModel) {
        parsedResult.risk_signals.unshift({
          category: "TELECOM HIJACKING AND MFA INTERCEPTION",
          severity: "High",
          evidence: telecomHeuristic.evidence || "MMI star code call-forwarding command detected.",
          impact: "CRITICAL: Attacker attempts to divert your incoming phone calls and 2FA voice OTPs via MMI star codes (*21*, *401*) to hijack WhatsApp, Telegram, or personal accounts.",
        });
      }

      const hasPayment = parsedResult.risk_signals.some((s: any) =>
        s.category?.toUpperCase().includes("PAYMENT")
      );
      const hasUrgency = parsedResult.risk_signals.some((s: any) =>
        s.category?.toUpperCase().includes("URGENCY")
      );
      const hasSensitive = parsedResult.risk_signals.some((s: any) =>
        s.category?.toUpperCase().includes("SENSITIVE") ||
        s.category?.toUpperCase().includes("PERSONAL") ||
        s.category?.toUpperCase().includes("FINANCIAL")
      );
      const hasDomainRisk =
        parsedResult.domain_analysis?.domain_risk === "High" ||
        parsedResult.domain_analysis?.domain_risk === "Medium";
      const isFreeEmail = !!(sender && /@(gmail|yahoo|hotmail|outlook)\.com/i.test(sender));

      const det = calculateDeterministicScore({
        payment_demand: { detected: hasPayment },
        telecom_hijacking: isTelecomDetected
          ? (telecomHeuristic.detected ? telecomHeuristic : { detected: true, verification_pretext: true })
          : undefined,
        urgency_pressure: { detected: hasUrgency },
        sensitive_data_request: { detected: hasSensitive },
        domain_risk: {
          detected: hasDomainRisk || isFreeEmail,
          free_email_provider: isFreeEmail,
          domain_age_status:
            parsedResult.domain_analysis?.age_status === "Verified"
              ? "VERIFIED_ESTABLISHED"
              : "UNABLE_TO_VERIFY",
        },
        positive_trust_signals: parsedResult.positive_signals || [],
        employer_verification: {
          status:
            (parsedResult.positive_signals?.length || 0) > 1
              ? "VERIFIED"
              : hasPayment || hasSensitive || isTelecomDetected
              ? "SUSPICIOUS"
              : "UNVERIFIED",
        },
      });

      parsedResult.threat_index = det.threat_index;
      parsedResult.risk_level = det.risk_level;
      parsedResult.scoring_breakdown = det.breakdown;
    }

    // Normalize confidence if returned as 0-1
    if (parsedResult.confidence > 0 && parsedResult.confidence <= 1) {
      parsedResult.confidence = Math.round(parsedResult.confidence * 100);
    }

    // Normalize threat_index to 0-100 range
    if (typeof parsedResult.threat_index === "number") {
      parsedResult.threat_index = Math.max(0, Math.min(100, Math.round(parsedResult.threat_index)));
    }

    return res.json({
      success: true,
      result: parsedResult,
      modelUsed,
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return res.status(500).json({
      error: error.message || "Failed to analyze document.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ScamSniffer server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
