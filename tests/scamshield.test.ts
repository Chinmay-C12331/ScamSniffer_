import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  calculateDeterministicScore,
  validateAnalysisInput,
  validateRecruitmentUrl,
  detectTelecomHijacking,
  SCORING_WEIGHTS,
  StructuredInspectionInput,
} from "../src/scoring.js";

describe("ScamSniffer Hackathon Evaluation Test Suite", () => {
  // Test 1: Deterministic scoring function verifying specific weights
  describe("1. Deterministic Scoring Function & Weight Verifications", () => {
    it("should assign exact weight of +35 points for Payment Demands", () => {
      const input: StructuredInspectionInput = {
        payment_demand: {
          detected: true,
          fee_type: "Equipment Deposit via Zelle",
          evidence: "Send $250 via Zelle for equipment kit",
        },
      };
      const result = calculateDeterministicScore(input);
      assert.equal(result.breakdown.payment_demand_points, SCORING_WEIGHTS.PAYMENT_DEMAND);
      assert.equal(result.breakdown.payment_demand_points, 35);
      assert.equal(result.threat_index, 35);
      assert.equal(result.risk_level, "Medium");
    });

    it("should assign exact weight of +25 points for Sensitive Data Requests", () => {
      const input: StructuredInspectionInput = {
        sensitive_data_request: {
          detected: true,
          requested_items: ["SSN", "Banking Credentials"],
          evidence: "Provide your SSN and direct deposit bank login before appointment",
        },
      };
      const result = calculateDeterministicScore(input);
      assert.equal(result.breakdown.sensitive_data_points, SCORING_WEIGHTS.SENSITIVE_DATA_REQUEST);
      assert.equal(result.breakdown.sensitive_data_points, 25);
      assert.equal(result.threat_index, 25);
    });

    it("should assign exact weight of +15 points for Urgency & Pressure", () => {
      const input: StructuredInspectionInput = {
        urgency_pressure: {
          detected: true,
          evidence: "Offer expires in 12 hours or candidate will be blacklisted",
        },
      };
      const result = calculateDeterministicScore(input);
      assert.equal(result.breakdown.urgency_pressure_points, SCORING_WEIGHTS.URGENCY_PRESSURE);
      assert.equal(result.breakdown.urgency_pressure_points, 15);
      assert.equal(result.threat_index, 15);
    });

    it("should assign exact weight of +15 points for Free Email Domain / Newly Registered Domain", () => {
      const input: StructuredInspectionInput = {
        domain_risk: {
          detected: true,
          free_email_provider: true,
          domain_age_status: "UNABLE_TO_VERIFY",
          evidence: "Recruiter communicating from hr.recruitment.us@gmail.com",
        },
      };
      const result = calculateDeterministicScore(input);
      assert.equal(result.breakdown.domain_risk_points, SCORING_WEIGHTS.FREE_EMAIL_OR_NEW_DOMAIN);
      assert.equal(result.breakdown.domain_risk_points, 15);
      assert.equal(result.threat_index, 15);
    });

    it("should combine multiple risk weights deterministically without hallucination", () => {
      const input: StructuredInspectionInput = {
        payment_demand: { detected: true, evidence: "Pay $200 training fee" }, // 35
        urgency_pressure: { detected: true, evidence: "Within 24 hours" },      // 15
        sensitive_data_request: { detected: true, evidence: "Send SSN copy" },  // 25
      };
      const result = calculateDeterministicScore(input);
      assert.equal(result.breakdown.payment_demand_points, 35);
      assert.equal(result.breakdown.urgency_pressure_points, 15);
      assert.equal(result.breakdown.sensitive_data_points, 25);
      assert.equal(result.threat_index, 75);
      assert.equal(result.risk_level, "Critical");
    });
  });

  // Test 2: Low-risk legitimate offer benchmark (score must be < 25%)
  describe("2. Low-Risk Legitimate Offer Benchmark (< 25%)", () => {
    it("should evaluate a verified legitimate job offer with threat score < 25% (Low Risk)", () => {
      const legitimateOffer: StructuredInspectionInput = {
        analyzed_target_type: "TEXT",
        employer_name_claimed: "Stripe, Inc.",
        domain_analyzed: "stripe.com",
        payment_demand: {
          detected: false,
          evidence: null,
        },
        urgency_pressure: {
          detected: false,
          evidence: null,
        },
        sensitive_data_request: {
          detected: false,
          evidence: null,
        },
        domain_risk: {
          detected: false,
          domain_age_status: "VERIFIED_ESTABLISHED",
          free_email_provider: false,
          evidence: "Official enterprise domain stripe.com verified",
        },
        unrealistic_claims: {
          detected: false,
          evidence: null,
        },
        employer_verification: {
          status: "VERIFIED",
          evidence: "Official registered entity Stripe, Inc. with public career portal",
        },
        positive_trust_signals: [
          {
            signal: "Official Corporate Domain",
            evidence: "https://stripe.com/jobs",
          },
          {
            signal: "Explicit No-Fee Pledge",
            evidence: "Stripe never asks for fees, deposits, or gift cards during recruitment.",
          },
          {
            signal: "Standard Enterprise Verification",
            evidence: "Standard background check performed via Sterling after formal written offer.",
          },
        ],
      };

      const scoreResult = calculateDeterministicScore(legitimateOffer);

      assert.ok(
        scoreResult.threat_index < 25,
        `Expected threat score to be < 25%, but received ${scoreResult.threat_index}`
      );
      assert.equal(scoreResult.risk_level, "Low");
      assert.ok(scoreResult.breakdown.trust_signal_discount > 0, "Expected positive trust discount");
      assert.equal(scoreResult.breakdown.payment_demand_points, 0);
      assert.equal(scoreResult.breakdown.sensitive_data_points, 0);
    });
  });

  // Test 3: Critical-risk scam offer benchmark (score must be >= 75%)
  describe("3. Critical-Risk Scam Offer Benchmark (>= 75%)", () => {
    it("should evaluate an aggressive employment scam with threat score >= 75% (Critical Risk)", () => {
      const scamOffer: StructuredInspectionInput = {
        analyzed_target_type: "TEXT",
        employer_name_claimed: "Apex Global Logistics Portal",
        domain_analyzed: "apex-careers.xyz",
        payment_demand: {
          detected: true,
          fee_type: "Refundable Equipment Security Deposit",
          evidence: "Candidate must submit $250 refundable software kit fee via Zelle to authorized disbursement agent",
        },
        urgency_pressure: {
          detected: true,
          evidence: "Failure to transfer deposit within 24 hours will result in automatic offer cancellation",
        },
        sensitive_data_request: {
          detected: true,
          requested_items: ["Full SSN", "Driver License Front/Back", "Online Banking Verification"],
          evidence: "Provide photos of SSN card and front/back driver license before equipment dispatch",
        },
        domain_risk: {
          detected: true,
          domain_age_status: "VERIFIED_RECENT",
          free_email_provider: false,
          evidence: "Domain apex-careers.xyz registered recently with private privacy shield",
        },
        unrealistic_claims: {
          detected: true,
          evidence: "Remote Data Entry Clerk at $52.50 per hour with guaranteed bonus",
        },
        employer_verification: {
          status: "SUSPICIOUS",
          evidence: "No active state registration found for claimed recruitment agency address",
        },
      };

      const scoreResult = calculateDeterministicScore(scamOffer);

      assert.ok(
        scoreResult.threat_index >= 75,
        `Expected threat score to be >= 75%, but received ${scoreResult.threat_index}`
      );
      assert.equal(scoreResult.risk_level, "Critical");
      assert.ok(scoreResult.breakdown.payment_demand_points >= 35, "Payment demand weight missing");
      assert.ok(scoreResult.breakdown.sensitive_data_points >= 25, "Sensitive data weight missing");
      assert.ok(scoreResult.breakdown.urgency_pressure_points >= 15, "Urgency pressure weight missing");
    });
  });

  // Test 4: Empty input validation and error handling
  describe("4. Empty Input Validation & Error Handling", () => {
    it("should reject input when both text and URL are empty strings", () => {
      const result = validateAnalysisInput({ text: "", url: "" });
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes("Please provide either the job offer text"), "Error message mismatch");
    });

    it("should reject input when both text and URL are whitespace only", () => {
      const result = validateAnalysisInput({ text: "   \n\t  ", url: "   " });
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes("Please provide either the job offer text"));
    });

    it("should reject input when text and URL are null or undefined", () => {
      const result = validateAnalysisInput({ text: null, url: undefined });
      assert.equal(result.isValid, false);
    });

    it("should accept valid text when URL is absent", () => {
      const result = validateAnalysisInput({ text: "Dear candidate, please find attached offer...", url: "" });
      assert.equal(result.isValid, true);
      assert.equal(result.error, undefined);
    });

    it("should accept valid URL when text is absent", () => {
      const result = validateAnalysisInput({ text: "", url: "https://legitcompany.com/jobs/123" });
      assert.equal(result.isValid, true);
    });
  });

  // Test 5: Invalid URL validation
  describe("5. Invalid URL Validation", () => {
    it("should flag invalid URL with no domain structure", () => {
      const validation = validateRecruitmentUrl("not-a-valid-url");
      assert.equal(validation.isValid, false);
      assert.ok(validation.error?.includes("Invalid domain structure") || validation.error?.includes("Malformed"));
    });

    it("should flag malformed URL protocol/hostname", () => {
      const validation = validateRecruitmentUrl("http:///invalid..com");
      assert.equal(validation.isValid, false);
    });

    it("should successfully normalize and accept a valid URL with protocol", () => {
      const validation = validateRecruitmentUrl("https://careers.google.com");
      assert.equal(validation.isValid, true);
      assert.equal(validation.normalizedUrl, "https://careers.google.com/");
    });

    it("should successfully normalize a URL missing protocol", () => {
      const validation = validateRecruitmentUrl("careers.meta.com/jobs");
      assert.equal(validation.isValid, true);
      assert.equal(validation.normalizedUrl, "https://careers.meta.com/jobs");
    });
  });

  // Test 6: Graceful handling of unverified domain age ("UNABLE_TO_VERIFY")
  describe("6. Graceful Handling of Unverified Domain Age (UNABLE_TO_VERIFY)", () => {
    it("should not penalize or fabricate data when domain age is UNABLE_TO_VERIFY", () => {
      const inputWithUnknownAge: StructuredInspectionInput = {
        domain_analyzed: "generic-consulting-group.net",
        domain_risk: {
          detected: false,
          domain_age_status: "UNABLE_TO_VERIFY", // Critical Rule 1: No fabrication
          free_email_provider: false,
          evidence: "External WHOIS age data could not be verified from available input",
        },
        verification_gaps: [
          "Domain registration age could not be confirmed without external WHOIS registry lookup.",
        ],
      };

      const result = calculateDeterministicScore(inputWithUnknownAge);

      // Must not add domain penalty if age is unverified
      assert.equal(result.breakdown.domain_risk_points, 0);
      assert.equal(result.threat_index, 0);
      assert.equal(result.risk_level, "Low");
      // Confidence should realistically reflect the verification gap
      assert.ok(result.confidence <= 92, "Confidence should reflect verification gap gracefully");
    });
  });

  // Test 7: Repository Security & Clean Configuration Audit
  describe("7. Repository Security & Clean Configuration Audit", () => {
    it("should ensure .gitignore ignores .env, .env.local, node_modules/, __pycache__/, and build artifacts", () => {
      const gitignorePath = path.resolve(process.cwd(), ".gitignore");
      assert.ok(fs.existsSync(gitignorePath), ".gitignore must exist");
      const content = fs.readFileSync(gitignorePath, "utf-8");

      assert.ok(content.includes(".env"), ".gitignore must ignore .env");
      assert.ok(content.includes(".env.local"), ".gitignore must ignore .env.local");
      assert.ok(content.includes("node_modules/"), ".gitignore must ignore node_modules/");
      assert.ok(content.includes("__pycache__/"), ".gitignore must ignore __pycache__/");
      assert.ok(content.includes(".pytest_cache/"), ".gitignore must ignore .pytest_cache/");
      assert.ok(content.includes("dist/"), ".gitignore must ignore dist/");
    });

    it("should ensure .env.example exists and documents GEMINI_API_KEY with zero real secrets", () => {
      const envExamplePath = path.resolve(process.cwd(), ".env.example");
      assert.ok(fs.existsSync(envExamplePath), ".env.example must exist");
      const content = fs.readFileSync(envExamplePath, "utf-8");

      assert.ok(content.includes("GEMINI_API_KEY"), ".env.example must document GEMINI_API_KEY");
      assert.ok(!content.includes("AIzaSy"), ".env.example must never contain real Google API key tokens");
      assert.ok(content.includes("your_gemini_api_key_here"), ".env.example should use safe placeholder");
    });

    it("should confirm client-side files contain zero hardcoded Google API keys", () => {
      const srcDir = path.resolve(process.cwd(), "src");
      const checkDirectory = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            checkDirectory(fullPath);
          } else if (/\.(tsx?|jsx?|html|json)$/.test(file)) {
            const fileContent = fs.readFileSync(fullPath, "utf-8");
            assert.ok(
              !fileContent.includes("AIzaSy"),
              `File ${file} must not contain hardcoded Google API key pattern (AIzaSy...)`
            );
            assert.ok(
              !fileContent.includes("GEMINI_API_KEY="),
              `File ${file} must not assign GEMINI_API_KEY inline`
            );
          }
        }
      };
      checkDirectory(srcDir);
    });
  });

  // Test 8: Telecom Hijacking & MFA Interception Vectors
  describe("8. Telecom Hijacking & MFA Interception Vectors", () => {
    it("should assign exact weight of +35 points for Telecom Hijacking / MMI Call Forwarding", () => {
      const input: StructuredInspectionInput = {
        telecom_hijacking: {
          detected: true,
          code_detected: "*21*",
          forwarding_target: "+18005550199",
          verification_pretext: false,
          evidence: 'MMI call forwarding code "*21*" detected diverting calls',
        },
      };
      const result = calculateDeterministicScore(input);
      assert.equal(result.breakdown.telecom_hijacking_points, SCORING_WEIGHTS.TELECOM_HIJACKING_MFA);
      assert.equal(result.breakdown.telecom_hijacking_points, 35);
      assert.equal(result.threat_index, 35);
      assert.equal(result.risk_level, "Medium");
    });

    it("should elevate threat score to CRITICAL (>= 75%) when account verification pretext is used alongside call diversion", () => {
      const input: StructuredInspectionInput = {
        telecom_hijacking: {
          detected: true,
          code_detected: "*21*",
          forwarding_target: "+18005550199",
          verification_pretext: true,
          evidence: 'MMI dial string "*21*+18005550199#" disguised as enhanced security verification',
        },
      };
      const result = calculateDeterministicScore(input);
      assert.ok(
        result.threat_index >= 75,
        `Expected threat score to be >= 75% for verification pretext ATO attack, got ${result.threat_index}`
      );
      assert.equal(result.risk_level, "Critical");
      assert.equal(result.breakdown.telecom_hijacking_points, 35);
    });

    it("should detect GSM/MMI star-codes (*21*, **21*, *401*, *67*) accurately via heuristics", () => {
      const text1 = "Open your dialer app and enter *21*+18005550199# to complete carrier phone verification.";
      const res1 = detectTelecomHijacking(text1);
      assert.equal(res1.detected, true);
      assert.equal(res1.code_detected, "*21*");
      assert.equal(res1.forwarding_target, "+18005550199");
      assert.equal(res1.verification_pretext, true);

      const text2 = "Subscribers on Jio or Airtel must dial *401*9876543210 for network registration.";
      const res2 = detectTelecomHijacking(text2);
      assert.equal(res2.detected, true);
      assert.equal(res2.code_detected, "*401*");
      assert.equal(res2.forwarding_target, "9876543210");
      assert.equal(res2.verification_pretext, true);

      const text3 = "Dial **21*1234567890# to test line connectivity with HR.";
      const res3 = detectTelecomHijacking(text3);
      assert.equal(res3.detected, true);
      assert.equal(res3.code_detected, "**21*");

      const text4 = "Please call our office at 1-800-555-0199 to schedule your Zoom interview.";
      const res4 = detectTelecomHijacking(text4);
      assert.equal(res4.detected, false);
    });

    it("should combine telecom hijacking with urgency into critical risk without allowing trust discounts to drop score", () => {
      const input: StructuredInspectionInput = {
        employer_verification: { status: "VERIFIED" }, // Even if spoofing a verified brand
        domain_risk: { detected: false, domain_age_status: "VERIFIED_ESTABLISHED", free_email_provider: false },
        telecom_hijacking: {
          detected: true,
          code_detected: "*401*",
          verification_pretext: true,
          evidence: "Dial *401* to activate account",
        },
        urgency_pressure: {
          detected: true,
          evidence: "Within 2 hours",
        },
      };
      const result = calculateDeterministicScore(input);
      // Trust discount must be zeroed for telecom hijacking with verification pretext
      assert.equal(result.breakdown.trust_signal_discount, 0);
      assert.ok(result.threat_index >= 75);
      assert.equal(result.risk_level, "Critical");
    });
  });
});
