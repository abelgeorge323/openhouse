# Build Royal Oaks candidates from Detroit V2 folder for dashboard data.json
import json
import csv
import os

BASE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(BASE, "Detroit V2")

def norm_name(s):
    """First word + last word for matching."""
    parts = (s or "").strip().split()
    if not parts: return ""
    if len(parts) == 1: return parts[0].lower()
    return (parts[0] + " " + parts[-1]).lower()

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_csv(path):
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))

# Load sources
dashboard = load_csv(os.path.join(V2, "dashboard.csv"))
combined = load_json(os.path.join(V2, "combined_scores.json"))
all_scores = load_json(os.path.join(V2, "all_scores.json"))
sentiment = load_json(os.path.join(V2, "sentiment_scores.json"))

# Index by candidate name (normalize for lookup)
combined_by_name = {norm_name(c["candidate_name"]): c for c in combined}
all_by_name = {norm_name(c["candidate_name"]): c for c in all_scores}
sentiment_by_name = {norm_name(c["candidate_name"]): c for c in sentiment}

# Resume dimension key mapping (V2 snake -> dashboard camelCase)
DIM_MAP = {
    "leadership_potential": "leadership",
    "initiative_drive": "initiative",
    "reliability": "reliability",
    "communication": "communication",
    "problem_solving": "problemSolving",
    "operations_exposure": "operations",
    "customer_service": "customerService",
    "community_teamwork": "communityTeamwork",
    "coachability": "coachability",
    "education_fit": "education",
}
SENT_MAP = {
    "leader_conviction": "leaderConviction",
    "impression_strength": "impressionStrength",
    "effort_initiative": "effortInitiative",
    "role_alignment": "roleAlignment",
    "concern_severity": "concernSeverity",
}

def status_display(s):
    if s == "INTERVIEW_CONSIDER": return "Interview"
    if s == "PENDING": return "Pending"
    if s == "POD": return "POD"
    return s or ""

def build_candidate(row):
    name = row["NAME"].strip()
    key = norm_name(name)
    rank = int(row["RANK"])
    resume = float(row["RESUME"])
    fit = float(row["FIT"])
    leader_flags = int(row["LEADER_FLAGS"])
    final = float(row["FINAL"])
    status = status_display(row["STATUS"])
    fit_source = (row.get("FIT_SOURCE") or "").strip()
    mit_badge = (row.get("MIT_BADGE") or "").strip()
    track = (row.get("TRACK") or "").strip()
    role = (row.get("ROLE") or "").strip().replace("_", " ") or ""
    career_stage = (row.get("CAREER_STAGE") or "").strip()
    true_mit_bonus = float(row.get("TRUE_MIT_BONUS") or 0)
    reloc_penalty = float(row.get("RELOC_PENALTY") or 0)

    co = combined_by_name.get(key) or {}
    al = all_by_name.get(key) or {}
    sent = sentiment_by_name.get(key)

    mismatch_flag = (co.get("mismatch_flag") or "").strip()
    mismatch_details = co.get("mismatch_details") or []
    resume_strengths = co.get("resume_strengths") or al.get("strengths") or []
    resume_gaps = co.get("resume_gaps") or al.get("gaps") or []
    benchmark = al.get("most_similar_benchmark", "")
    sim_pct = al.get("similarity_pct")
    benchmark_match = f"{benchmark} ({sim_pct:.0f}%)" if benchmark and sim_pct is not None else ""

    resume_dim_raw = al.get("dimensions") or {}
    resume_dimensions = {}
    for skey, v in resume_dim_raw.items():
        camel = DIM_MAP.get(skey)
        if camel is not None:
            resume_dimensions[camel] = round(v, 1)

    sentiment_dimensions = None
    if sent and sent.get("dimensions"):
        sentiment_dimensions = {}
        for skey, v in sent["dimensions"].items():
            camel = SENT_MAP.get(skey)
            if camel is not None:
                sentiment_dimensions[camel] = round(v, 1)

    # Detail: we'll attach from current data.json by name match (done in main)
    detail = None

    return {
        "name": name,
        "rank": rank,
        "resume": round(resume, 1),
        "fit": round(fit, 1),
        "leaderFlags": leader_flags,
        "final": round(final, 1),
        "status": status,
        "fitSource": fit_source,
        "mitBadge": mit_badge,
        "track": track,
        "role": role,
        "careerStage": career_stage,
        "trueMitBonus": true_mit_bonus,
        "relocPenalty": reloc_penalty,
        "mismatchFlag": mismatch_flag,
        "mismatchDetails": mismatch_details,
        "resumeDimensions": resume_dimensions if resume_dimensions else None,
        "resumeStrengths": resume_strengths,
        "resumeGaps": resume_gaps,
        "sentimentDimensions": sentiment_dimensions,
        "benchmarkMatch": benchmark_match,
        "location": "",
        "detail": detail,
    }

# Build list from dashboard order
candidates = []
for row in dashboard:
    c = build_candidate(row)
    candidates.append(c)

# Load current data.json to steal detail (education, relocation, leaderNotes) by name match
data_path = os.path.join(BASE, "data.json")
with open(data_path, "r", encoding="utf-8") as f:
    data = json.load(f)

royal = next((e for e in data["events"] if e.get("id") == "royaloaks"), None)
if royal and royal.get("candidates"):
    old_by_key = {norm_name(c["name"]): c for c in royal["candidates"]}
    for c in candidates:
        old = old_by_key.get(norm_name(c["name"]))
        if old and old.get("detail"):
            c["detail"] = old["detail"]
        if old and old.get("location"):
            c["location"] = old["location"]
        if not c["detail"] and c.get("resumeDimensions"):
            c["detail"] = {
                "education": "",
                "relocation": "",
                "leaderNotes": "No leader check-in submitted. Resume scored but awaiting leader feedback." if c.get("fitSource") == "trait_estimate" else ""
            }

# Add Sinda Mills (unscored) if not in dashboard
if not any(norm_name(c["name"]) == "sinda mills" for c in candidates):
    candidates.append({
        "name": "Sinda Mills",
        "rank": 0,
        "resume": 0,
        "fit": 0,
        "leaderFlags": 0,
        "final": 0,
        "status": "Hold",
        "fitSource": "none",
        "mitBadge": "",
        "track": "",
        "role": "",
        "careerStage": "",
        "trueMitBonus": 0.0,
        "relocPenalty": 0.0,
        "mismatchFlag": "",
        "mismatchDetails": [],
        "resumeDimensions": None,
        "resumeStrengths": [],
        "resumeGaps": [],
        "sentimentDimensions": None,
        "benchmarkMatch": "",
        "location": "",
        "detail": {
            "education": "University of Phoenix — BA in Management",
            "relocation": "Local Only",
            "leaderNotes": "No resume submitted. No leader check-in submitted."
        }
    })

# Write back into data.json
royal["candidates"] = candidates
with open(data_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Updated data.json: Royal Oaks candidates from Detroit V2:", len(candidates))
