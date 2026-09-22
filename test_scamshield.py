"""
ScamSniffer - Hackathon Evaluation Test Suite (Python Unittest / Pytest compatible)

Covers:
1. Deterministic scoring function (verifying weights: payment demand, urgency, sensitive info, free email domain).
2. Low-risk legitimate offer benchmark (score should be < 25%).
3. Critical-risk scam offer (score should be >= 75%).
4. Empty input validation and error handling.
5. Invalid URL validation.
6. Graceful handling of unverified domain age ("UNABLE_TO_VERIFY").
"""

import unittest
from urllib.parse import urlparse

SCORING_WEIGHTS = {
    "PAYMENT_DEMAND": 35,
    "TELECOM_HIJACKING_MFA": 35,
    "SENSITIVE_DATA_REQUEST": 25,
    "URGENCY_PRESSURE": 15,
    "FREE_EMAIL_OR_NEW_DOMAIN": 15,
    "UNREALISTIC_CLAIMS": 10,
    "EMPLOYER_SUSPICION": 10,
    "MAX_TRUST_DISCOUNT": 25,
}

def validate_recruitment_url(raw_url: str):
    if not raw_url or not raw_url.strip():
        return False, "URL cannot be empty."
    candidate = raw_url.strip()
    if not (candidate.startswith("http://") or candidate.startswith("https://")):
        candidate = f"https://{candidate}"
    try:
        parsed = urlparse(candidate)
        if not parsed.hostname or "." not in parsed.hostname:
            return False, "Invalid domain structure."
        parts = parsed.hostname.split(".")
        if any(len(p) == 0 for p in parts):
            return False, "Malformed domain hostname."
        return True, candidate
    except Exception as e:
        return False, str(e)

def validate_analysis_input(payload: dict):
    text = (payload.get("text") or "").strip()
    url = (payload.get("url") or "").strip()
    if not text and not url:
        return False, "Please provide either the job offer text, an email/message, or a recruitment URL to analyze."
    if url and not text:
        valid, err = validate_recruitment_url(url)
        if not valid:
            return False, f"Invalid recruitment URL: {err}"
    return True, None

def calculate_deterministic_score(signals: dict) -> dict:
    score = 0
    breakdown = {}

    # 1. Payment demand (+35)
    payment = signals.get("payment_demand", {})
    p_pts = SCORING_WEIGHTS["PAYMENT_DEMAND"] if payment.get("detected") else 0
    score += p_pts
    breakdown["payment_demand_points"] = p_pts

    # 2. Telecom Hijacking / MMI Call Forwarding / MFA Interception (+35)
    telecom = signals.get("telecom_hijacking", {})
    t_pts = SCORING_WEIGHTS["TELECOM_HIJACKING_MFA"] if telecom.get("detected") else 0
    score += t_pts
    breakdown["telecom_hijacking_points"] = t_pts

    # 3. Sensitive data request (+25)
    sens = signals.get("sensitive_data_request", {})
    s_pts = SCORING_WEIGHTS["SENSITIVE_DATA_REQUEST"] if sens.get("detected") else 0
    score += s_pts
    breakdown["sensitive_data_points"] = s_pts

    # 4. Urgency & pressure (+15)
    urg = signals.get("urgency_pressure", {})
    u_pts = SCORING_WEIGHTS["URGENCY_PRESSURE"] if urg.get("detected") else 0
    score += u_pts
    breakdown["urgency_pressure_points"] = u_pts

    # 5. Domain & Sender Risk (+15)
    dom = signals.get("domain_risk", {})
    d_pts = 0
    if dom.get("free_email_provider"):
        d_pts = SCORING_WEIGHTS["FREE_EMAIL_OR_NEW_DOMAIN"]
    elif dom.get("domain_age_status") == "VERIFIED_RECENT":
        d_pts = SCORING_WEIGHTS["FREE_EMAIL_OR_NEW_DOMAIN"]
    elif dom.get("detected"):
        d_pts = 10
    d_pts = min(d_pts, SCORING_WEIGHTS["FREE_EMAIL_OR_NEW_DOMAIN"])
    score += d_pts
    breakdown["domain_risk_points"] = d_pts

    # 6. Unrealistic claims (+10)
    unr = signals.get("unrealistic_claims", {})
    unr_pts = SCORING_WEIGHTS["UNREALISTIC_CLAIMS"] if unr.get("detected") else 0
    score += unr_pts
    breakdown["unrealistic_claims_points"] = unr_pts

    # 7. Employer Suspicion (+10)
    emp = signals.get("employer_verification", {})
    emp_pts = SCORING_WEIGHTS["EMPLOYER_SUSPICION"] if emp.get("status") == "SUSPICIOUS" else 0
    score += emp_pts
    breakdown["employer_suspicion_points"] = emp_pts

    # 8. Trust discounts (subtract up to 25)
    trust_discount = 0
    if emp.get("status") == "VERIFIED":
        trust_discount += 15
    if dom.get("domain_age_status") == "VERIFIED_ESTABLISHED":
        trust_discount += 10
    trust_signals = signals.get("positive_trust_signals", [])
    if trust_signals:
        trust_discount += min(10, len(trust_signals) * 5)
    trust_discount = min(trust_discount, SCORING_WEIGHTS["MAX_TRUST_DISCOUNT"])

    if p_pts > 0 and s_pts > 0:
        trust_discount = min(trust_discount, 10)

    # Telecom hijacking is an active account takeover attempt; zero out trust discounts
    if t_pts > 0:
        trust_discount = 0

    final_score = max(0, min(100, round(score - trust_discount)))

    # Elevation rule for account verification pretext
    if t_pts > 0 and telecom.get("verification_pretext"):
        if final_score < 75:
            final_score = 75

    if final_score >= 75:
        risk_level = "Critical"
    elif final_score >= 50:
        risk_level = "High"
    elif final_score >= 25:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return {
        "threat_index": final_score,
        "risk_level": risk_level,
        "breakdown": breakdown,
        "confidence": 95 if p_pts > 0 else 90,
    }


class TestScamSniffer(unittest.TestCase):
    # 1. Deterministic Scoring Weights
    def test_payment_demand_weight(self):
        res = calculate_deterministic_score({
            "payment_demand": {"detected": True, "fee_type": "Zelle Deposit"}
        })
        self.assertEqual(res["breakdown"]["payment_demand_points"], 35)
        self.assertEqual(res["threat_index"], 35)

    def test_sensitive_data_weight(self):
        res = calculate_deterministic_score({
            "sensitive_data_request": {"detected": True}
        })
        self.assertEqual(res["breakdown"]["sensitive_data_points"], 25)
        self.assertEqual(res["threat_index"], 25)

    def test_urgency_pressure_weight(self):
        res = calculate_deterministic_score({
            "urgency_pressure": {"detected": True}
        })
        self.assertEqual(res["breakdown"]["urgency_pressure_points"], 15)
        self.assertEqual(res["threat_index"], 15)

    def test_free_email_domain_weight(self):
        res = calculate_deterministic_score({
            "domain_risk": {"detected": True, "free_email_provider": True}
        })
        self.assertEqual(res["breakdown"]["domain_risk_points"], 15)
        self.assertEqual(res["threat_index"], 15)

    def test_combined_weights(self):
        res = calculate_deterministic_score({
            "payment_demand": {"detected": True},
            "sensitive_data_request": {"detected": True},
            "urgency_pressure": {"detected": True},
        })
        self.assertEqual(res["threat_index"], 75)
        self.assertEqual(res["risk_level"], "Critical")

    # 2. Low-Risk Legitimate Offer Benchmark (< 25%)
    def test_low_risk_legitimate_benchmark(self):
        legitimate = {
            "employer_name_claimed": "Stripe, Inc.",
            "payment_demand": {"detected": False},
            "urgency_pressure": {"detected": False},
            "sensitive_data_request": {"detected": False},
            "domain_risk": {"detected": False, "domain_age_status": "VERIFIED_ESTABLISHED"},
            "employer_verification": {"status": "VERIFIED"},
            "positive_trust_signals": [
                {"signal": "Official Domain", "evidence": "stripe.com"},
                {"signal": "No Fee Policy", "evidence": "Never asks for fees"},
            ]
        }
        res = calculate_deterministic_score(legitimate)
        self.assertLess(res["threat_index"], 25, f"Score should be < 25%, got {res['threat_index']}")
        self.assertEqual(res["risk_level"], "Low")

    # 3. Critical-Risk Scam Offer (>= 75%)
    def test_critical_risk_scam_benchmark(self):
        scam = {
            "payment_demand": {"detected": True, "fee_type": "Zelle Equipment Fee"},
            "urgency_pressure": {"detected": True, "evidence": "Pay in 24 hours"},
            "sensitive_data_request": {"detected": True, "requested_items": ["SSN", "Direct Deposit"]},
            "domain_risk": {"detected": True, "domain_age_status": "VERIFIED_RECENT"},
            "unrealistic_claims": {"detected": True, "evidence": "$52/hr Data Entry"},
        }
        res = calculate_deterministic_score(scam)
        self.assertGreaterEqual(res["threat_index"], 75, f"Score should be >= 75%, got {res['threat_index']}")
        self.assertEqual(res["risk_level"], "Critical")

    # 4. Empty Input Validation and Error Handling
    def test_empty_input_validation(self):
        valid, err = validate_analysis_input({"text": "", "url": ""})
        self.assertFalse(valid)
        self.assertIn("Please provide either the job offer text", err)

        valid_whitespace, _ = validate_analysis_input({"text": "   ", "url": "  "})
        self.assertFalse(valid_whitespace)

        valid_text, _ = validate_analysis_input({"text": "Valid job offer body", "url": ""})
        self.assertTrue(valid_text)

        valid_url, _ = validate_analysis_input({"text": "", "url": "https://company.com/job"})
        self.assertTrue(valid_url)

    # 5. Invalid URL Validation
    def test_invalid_url_validation(self):
        valid, _ = validate_recruitment_url("not-a-domain")
        self.assertFalse(valid)

        valid_norm, norm = validate_recruitment_url("google.com/careers")
        self.assertTrue(valid_norm)
        self.assertTrue(norm.startswith("https://google.com/careers"))

    # 6. Graceful Handling of Unverified Domain Age (UNABLE_TO_VERIFY)
    def test_unverified_domain_age_graceful(self):
        unverified = {
            "domain_risk": {
                "detected": False,
                "domain_age_status": "UNABLE_TO_VERIFY",
                "free_email_provider": False,
            }
        }
        res = calculate_deterministic_score(unverified)
        self.assertEqual(res["breakdown"]["domain_risk_points"], 0)
        self.assertEqual(res["threat_index"], 0)
        self.assertEqual(res["risk_level"], "Low")

    # 7. Repository Security & Clean Configuration Audit
    def test_repository_security_audit(self):
        import os
        # 1. .gitignore checks
        self.assertTrue(os.path.exists(".gitignore"), ".gitignore must exist")
        with open(".gitignore", "r") as f:
            gi_content = f.read()
        self.assertIn(".env", gi_content)
        self.assertIn(".env.local", gi_content)
        self.assertIn("node_modules/", gi_content)
        self.assertIn("__pycache__/", gi_content)
        self.assertIn(".pytest_cache/", gi_content)
        self.assertIn("dist/", gi_content)

        # 2. .env.example checks
        self.assertTrue(os.path.exists(".env.example"), ".env.example must exist")
        with open(".env.example", "r") as f:
            env_content = f.read()
        self.assertIn("GEMINI_API_KEY", env_content)
        self.assertNotIn("AIzaSy", env_content, "Real API key tokens must never be in .env.example")
        self.assertIn("your_gemini_api_key_here", env_content)

        # 3. Client-side code check for zero hardcoded secrets
        for root, dirs, files in os.walk("src"):
            for file in files:
                if file.endswith((".ts", ".tsx", ".js", ".jsx", ".html")):
                    file_path = os.path.join(root, file)
                    with open(file_path, "r", encoding="utf-8") as f:
                        code = f.read()
                    self.assertNotIn("AIzaSy", code, f"Hardcoded Google API key found in {file_path}")
                    self.assertNotIn("GEMINI_API_KEY=", code, f"Hardcoded inline GEMINI_API_KEY assignment found in {file_path}")

    # 8. Telecom Hijacking & MFA Interception Vectors
    def test_telecom_hijacking_and_pretext_elevation(self):
        # Base weight check (+35)
        res_standard = calculate_deterministic_score({
            "telecom_hijacking": {"detected": True, "verification_pretext": False}
        })
        self.assertEqual(res_standard["breakdown"]["telecom_hijacking_points"], 35)
        self.assertEqual(res_standard["threat_index"], 35)
        self.assertEqual(res_standard["risk_level"], "Medium")

        # Elevation to critical (>= 75%) with account verification pretext
        res_pretext = calculate_deterministic_score({
            "telecom_hijacking": {"detected": True, "verification_pretext": True}
        })
        self.assertGreaterEqual(res_pretext["threat_index"], 75)
        self.assertEqual(res_pretext["risk_level"], "Critical")
        self.assertEqual(res_pretext["breakdown"]["telecom_hijacking_points"], 35)


if __name__ == "__main__":
    unittest.main(verbosity=2)
