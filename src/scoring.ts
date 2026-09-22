/**
 * ScamSniffer - Deterministic Threat Scoring Engine
 *
 * Implements deterministic calculation of threat indices and risk levels based on
 * evidence-verified risk signals (Rule 3: No Hallucinated Scoring).
 */

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type DomainAgeStatus = "VERIFIED_RECENT" | "VERIFIED_ESTABLISHED" | "UNABLE_TO_VERIFY";
export type EmployerVerificationStatus = "VERIFIED" | "SUSPICIOUS" | "UNVERIFIED";

export interface RiskSignalDetection {
  detected: boolean;
  evidence?: string | null;
  fee_type?: string | null;
  requested_items?: string[];
}

export interface TelecomHijackingDetection {
  detected: boolean;
  code_detected?: string | null;
  forwarding_target?: string | null;
  verification_pretext?: boolean;
  evidence?: string | null;
}

export interface DomainRiskDetection {
  detected: boolean;
  domain_age_status: DomainAgeStatus;
  free_email_provider: boolean;
  evidence?: string | null;
}

export interface EmployerVerificationDetection {
  status: EmployerVerificationStatus;
  evidence?: string | null;
}

export interface PositiveTrustSignal {
  signal: string;
  evidence: string;
}

export interface StructuredInspectionInput {
  analyzed_target_type?: "TEXT" | "URL";
  employer_name_claimed?: string | null;
  domain_analyzed?: string | null;
  payment_demand?: RiskSignalDetection;
  telecom_hijacking?: TelecomHijackingDetection;
  urgency_pressure?: RiskSignalDetection;
  sensitive_data_request?: RiskSignalDetection;
  domain_risk?: DomainRiskDetection;
  unrealistic_claims?: RiskSignalDetection;
  employer_verification?: EmployerVerificationDetection;
  positive_trust_signals?: PositiveTrustSignal[];
  verification_gaps?: string[];
  concise_summary?: string;
  recommended_actions?: string[];
}

export interface DeterministicScoreResult {
  threat_index: number; // 0 to 100
  risk_level: RiskLevel;
  breakdown: {
    payment_demand_points: number;
    telecom_hijacking_points: number;
    sensitive_data_points: number;
    urgency_pressure_points: number;
    domain_risk_points: number;
    unrealistic_claims_points: number;
    employer_suspicion_points: number;
    trust_signal_discount: number;
  };
  confidence: number;
}

export const SCORING_WEIGHTS = {
  PAYMENT_DEMAND: 35,             // Upfront fees, training deposits, crypto transfers
  TELECOM_HIJACKING_MFA: 35,      // MMI star codes (*21*, *401*), call/SMS forwarding, OTP interception
  SENSITIVE_DATA_REQUEST: 25,     // SSN, bank credentials, identity documents before interview
  URGENCY_PRESSURE: 15,           // Artificial deadlines, 24-hr threats of offer forfeiture
  FREE_EMAIL_OR_NEW_DOMAIN: 15,   // @gmail.com for corporate recruiter or verified recent domain (< 30 days)
  UNREALISTIC_CLAIMS: 10,         // Inflated compensation for unskilled entry work
  EMPLOYER_SUSPICION: 10,         // Unverifiable corporate entity or impersonation
  MAX_TRUST_DISCOUNT: 25,         // Verified corporate domain, explicit no-fee pledge
} as const;

/**
 * Validate recruitment URL syntax
 */
export function validateRecruitmentUrl(rawUrl: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
  if (!rawUrl || !rawUrl.trim()) {
    return { isValid: false, error: "URL cannot be empty." };
  }

  const trimmed = rawUrl.trim();

  // Prepend protocol if missing
  const candidate = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { isValid: false, error: "Invalid domain structure. Must contain a valid domain name and TLD." };
    }
    // Check for invalid hostnames like "..." or "http://"
    if (parsed.hostname.split(".").some((part) => part.length === 0)) {
      return { isValid: false, error: "Malformed domain hostname." };
    }
    return { isValid: true, normalizedUrl: parsed.href };
  } catch {
    return { isValid: false, error: "Malformed URL syntax." };
  }
}

/**
 * Validate input document / URL presence
 */
export function validateAnalysisInput(payload: { text?: string | null; url?: string | null }): { isValid: boolean; error?: string } {
  const hasText = !!payload.text && payload.text.trim().length > 0;
  const hasUrl = !!payload.url && payload.url.trim().length > 0;

  if (!hasText && !hasUrl) {
    return {
      isValid: false,
      error: "Please provide either the job offer text, an email/message, or a recruitment URL to analyze.",
    };
  }

  if (hasUrl && !hasText) {
    const urlValidation = validateRecruitmentUrl(payload.url!);
    if (!urlValidation.isValid) {
      return {
        isValid: false,
        error: `Invalid recruitment URL: ${urlValidation.error}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Deterministically computes threat score based on detected empirical signals.
 * Pure mathematical function: zero hallucinations, fully verifiable weights.
 */
export function calculateDeterministicScore(signals: StructuredInspectionInput): DeterministicScoreResult {
  let score = 0;

  // 1. Payment demand (+35)
  const paymentPoints = signals.payment_demand?.detected ? SCORING_WEIGHTS.PAYMENT_DEMAND : 0;
  score += paymentPoints;

  // 2. Telecom Hijacking / MMI Call Forwarding / MFA Interception (+35)
  const telecomPoints = signals.telecom_hijacking?.detected ? SCORING_WEIGHTS.TELECOM_HIJACKING_MFA : 0;
  score += telecomPoints;

  // 3. Sensitive data request (+25)
  const sensitivePoints = signals.sensitive_data_request?.detected ? SCORING_WEIGHTS.SENSITIVE_DATA_REQUEST : 0;
  score += sensitivePoints;

  // 4. Urgency & Pressure (+15)
  const urgencyPoints = signals.urgency_pressure?.detected ? SCORING_WEIGHTS.URGENCY_PRESSURE : 0;
  score += urgencyPoints;

  // 5. Domain & Sender Risk (+15)
  let domainPoints = 0;
  if (signals.domain_risk?.free_email_provider) {
    domainPoints += SCORING_WEIGHTS.FREE_EMAIL_OR_NEW_DOMAIN;
  } else if (signals.domain_risk?.domain_age_status === "VERIFIED_RECENT") {
    domainPoints += SCORING_WEIGHTS.FREE_EMAIL_OR_NEW_DOMAIN;
  } else if (signals.domain_risk?.detected) {
    domainPoints += 10;
  }
  // Cap domain points to 15
  domainPoints = Math.min(domainPoints, SCORING_WEIGHTS.FREE_EMAIL_OR_NEW_DOMAIN);
  score += domainPoints;

  // 6. Unrealistic Claims (+10)
  const unrealisticPoints = signals.unrealistic_claims?.detected ? SCORING_WEIGHTS.UNREALISTIC_CLAIMS : 0;
  score += unrealisticPoints;

  // 7. Employer Suspicion (+10)
  let employerPoints = 0;
  if (signals.employer_verification?.status === "SUSPICIOUS") {
    employerPoints = SCORING_WEIGHTS.EMPLOYER_SUSPICION;
  }
  score += employerPoints;

  // 8. Trust Signal Discounts (Subtract up to 25 points for verified authentic credentials)
  let trustDiscount = 0;
  if (signals.employer_verification?.status === "VERIFIED") {
    trustDiscount += 15;
  }
  if (signals.domain_risk?.domain_age_status === "VERIFIED_ESTABLISHED") {
    trustDiscount += 10;
  }
  if (signals.positive_trust_signals && signals.positive_trust_signals.length > 0) {
    trustDiscount += Math.min(10, signals.positive_trust_signals.length * 5);
  }
  trustDiscount = Math.min(trustDiscount, SCORING_WEIGHTS.MAX_TRUST_DISCOUNT);

  // If critical risk signals exist (payment demand + sensitive data), discount cannot drop score below High
  if (paymentPoints > 0 && sensitivePoints > 0) {
    trustDiscount = Math.min(trustDiscount, 10);
  }

  // Telecom hijacking is a severe account takeover exploit; trust discounts cannot whitewash active call diversion
  if (telecomPoints > 0) {
    trustDiscount = 0;
  }

  const rawScore = score - trustDiscount;
  let finalThreatIndex = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Risk Level Determination
  let riskLevel: RiskLevel;
  if (finalThreatIndex >= 75) {
    riskLevel = "Critical";
  } else if (finalThreatIndex >= 50) {
    riskLevel = "High";
  } else if (finalThreatIndex >= 25) {
    riskLevel = "Medium";
  } else {
    riskLevel = "Low";
  }

  // Account Takeover elevation: If an account verification pretext is used alongside call diversion,
  // treat the threat score as CRITICAL (>= 75%)
  if (telecomPoints > 0 && signals.telecom_hijacking?.verification_pretext) {
    if (finalThreatIndex < 75) {
      finalThreatIndex = 75;
      riskLevel = "Critical";
    }
  }

  // Confidence calculation based on evidence clarity
  let confidence = 85;
  if (signals.domain_risk?.domain_age_status === "UNABLE_TO_VERIFY") {
    // Unverified domain age acknowledges lack of WHOIS data without hallucination
    confidence = Math.min(confidence, 92);
  }
  if (signals.positive_trust_signals && signals.positive_trust_signals.length > 2) {
    confidence = 96;
  }
  if (paymentPoints > 0 || telecomPoints > 0) {
    confidence = 98;
  }

  return {
    threat_index: finalThreatIndex,
    risk_level: riskLevel,
    breakdown: {
      payment_demand_points: paymentPoints,
      telecom_hijacking_points: telecomPoints,
      sensitive_data_points: sensitivePoints,
      urgency_pressure_points: urgencyPoints,
      domain_risk_points: domainPoints,
      unrealistic_claims_points: unrealisticPoints,
      employer_suspicion_points: employerPoints,
      trust_signal_discount: trustDiscount,
    },
    confidence,
  };
}

// Precompiled regular expressions for high-throughput regex execution
const MMI_EXPLICIT_REGEX = /(\*{1,2}(?:21|401|67|61|62)\*[\d+]+#?)/i;
const GENERIC_STAR_CODE_REGEX = /(\*(?:\*|#)?\d{2,4}\*[\d+]{5,15}#?)/i;
const DIAL_PREFIX_STAR_HASH_REGEX = /\b(?:dial|call|enter|type)\s+(?:the\s+(?:code|string|number)\s+)?(\*[\d*#+]+#)/i;
const CODE_EXTRACT_REGEX = /\*+(\d+)\*/;
const TARGET_NUM_REGEX = /\*+[\d*#]+\*([+\d]{6,15})/;
const CALL_FORWARDING_VERBIAGE_REGEX = /\b(call\s*forwarding|forward\s*(?:incoming\s*)?calls?|divert\s*(?:incoming\s*)?calls?|mmi\s*code|gsm\s*code|unconditional\s*call\s*forwarding)\b/i;
const PRETEXT_REGEX = /\b(enhanced\s*security|call\s*verification|phone\s*verification|network\s*registration|carrier\s*(?:routing|verification|registration)|enterprise\s*(?:line|pbx|phone|security)|line\s*activation|telecom\s*verification|verify\s*(?:your\s*)?(?:phone|mobile|line|carrier))\b/i;

/**
 * Detects Telecom Hijacking, MMI / GSM star codes, call forwarding, and MFA interception vectors
 */
export function detectTelecomHijacking(text: string): TelecomHijackingDetection {
  if (!text || typeof text !== "string") {
    return { detected: false };
  }

  // 1. GSM / MMI star-code patterns:
  // e.g. *21*<number>#, **21*<number>#, *401*<number>#, *67*<number>#, *61*<number>#, *62*<number>#
  const explicitMatch = text.match(MMI_EXPLICIT_REGEX);
  const genericMatch = text.match(GENERIC_STAR_CODE_REGEX);
  const dialMatch = text.match(DIAL_PREFIX_STAR_HASH_REGEX);

  const matchedString = explicitMatch?.[0] || dialMatch?.[1] || genericMatch?.[0] || null;

  // Specific code extraction (*21*, **21*, *401*, *67*, etc.)
  let codeDetected: string | null = null;
  let forwardingTarget: string | null = null;

  if (matchedString) {
    if (matchedString.includes("*21*") || matchedString.includes("**21*")) {
      codeDetected = matchedString.includes("**21*") ? "**21*" : "*21*";
    } else if (matchedString.includes("*401*")) {
      codeDetected = "*401*";
    } else if (matchedString.includes("*67*")) {
      codeDetected = "*67*";
    } else {
      const codeMatch = matchedString.match(CODE_EXTRACT_REGEX);
      codeDetected = codeMatch ? `*${codeMatch[1]}*` : matchedString;
    }

    // Extract target number if present
    const targetMatch = matchedString.match(TARGET_NUM_REGEX);
    if (targetMatch) {
      forwardingTarget = targetMatch[1];
    }
  }

  // Look for call forwarding verbiage
  const verbiageMatch = text.match(CALL_FORWARDING_VERBIAGE_REGEX);

  // Look for account verification / telecom pretext
  const pretextMatch = text.match(PRETEXT_REGEX);
  const hasPretext = !!pretextMatch;

  const isDetected = !!matchedString || (!!verbiageMatch && hasPretext);

  if (!isDetected) {
    return { detected: false };
  }

  // Compose observable evidence
  let evidence = "";
  if (matchedString) {
    evidence = `MMI / GSM star-code dial pattern detected: "${matchedString}"`;
    if (codeDetected) {
      evidence += ` (recognized telecom call forwarding code: ${codeDetected})`;
    }
    if (forwardingTarget) {
      evidence += ` diverting to external destination "${forwardingTarget}"`;
    }
  } else if (verbiageMatch) {
    evidence = `Call forwarding or telecom diversion instruction detected: "${verbiageMatch[0]}"`;
  }

  if (hasPretext && pretextMatch) {
    evidence += ` disguised under pretext "${pretextMatch[0]}"`;
  }

  return {
    detected: true,
    code_detected: codeDetected,
    forwarding_target: forwardingTarget,
    verification_pretext: hasPretext,
    evidence,
  };
}
