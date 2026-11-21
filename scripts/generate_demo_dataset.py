"""Regenerate fictional demo fixtures. No official registration numbers are created."""
import json
from pathlib import Path


DATA = Path(__file__).resolve().parent.parent / "backend" / "data"
TERM = "ผลิตภัณฑ์เสริมอาหาร"


def write(name, value):
    (DATA / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def generate():
    registry = {
        "DEMO-001": dict(product_name="Demo Supplement", license_holder="Demo Brand", category="supplement", active=True, advertising_permit="DEMO-AD-001"),
        "DEMO-REVOKED": dict(product_name="Firming Serum", license_holder="Demo Brand", category="cosmetic", active=False),
        "DEMO-COLLAGEN": dict(product_name="Demo Collagen", license_holder="Demo Brand", category="supplement", active=True, advertising_permit="DEMO-AD-COLLAGEN"),
        "DEMO-FISH-OIL": dict(product_name="Demo Fish Oil", license_holder="Demo Brand", category="supplement", active=True, advertising_permit="DEMO-AD-FISH"),
    }
    for name in ("FIBRE", "SLIM", "MELON", "LIVER", "GINSENG", "VITC", "JOINT", "GLOW", "KIDS", "SLEEP", "TONIC", "WHEY", "OAT", "SUNSCREEN"):
        registry["DEMO-" + name] = dict(
            product_name="Demo " + name.title(), license_holder="Demo Brand",
            category="drug" if name == "TONIC" else "cosmetic" if name == "SUNSCREEN" else "supplement",
            active=name not in {"FIBRE", "GINSENG", "SLEEP"},
            registration_status="EXPIRED" if name in {"FIBRE", "SLEEP"} else "REVOKED" if name == "GINSENG" else "ACTIVE",
            advertising_permit="DEMO-AD-" + name, permit_required=name == "JOINT",
            permit_active=name != "MELON",
        )
    listings = {}

    def case(number, reference, group, expected, failures=(), language="th", **changes):
        record = registry.get(reference, registry["DEMO-001"])
        payload = {key: record[key] for key in ("product_name", "license_holder", "category")}
        payload.update(registration_reference=reference, description=TERM if payload["category"] == "supplement" else "Synthetic cosmetic",
            title="", advertising_permit=record.get("advertising_permit"))
        payload.update(changes)
        listings["L" + str(number)] = dict(payload, group=group, language=language, expected_status=expected,
            expected_failures=list(failures), llm_dependent=False, shop_age_days=number * 17)

    case(1,"DEMO-001","G2","PENDING",["R-01","R-03"],"en",product_name="Turmeric Blend",title="reverses diabetes")
    case(2,"DEMO-COLLAGEN","G13","APPROVED")
    case(3,"DEMO-REVOKED","G7","DENIED",["R-01"])
    case(4,"DEMO-COLLAGEN","G1","DENIED",["R-03"],"en",title="prevents obesity")
    case(5,"MISSING","G12","UNKNOWN",advertising_permit=None)
    case(6,"DEMO-FISH-OIL","G13","APPROVED")
    case(7,"DEMO-FISH-OIL","G13","PENDING",["R-04"],advertising_permit="DEMO-AD-CONFLICT")
    case(8,"MALFORMED","G12","UNKNOWN")
    case(9,"DEMO-FIBRE","G13","DENIED",["R-01"])
    case(10,"DEMO-COLLAGEN","G10","DENIED",["R-02","R-03"],title="ยารักษาความดัน")
    case(11,"DEMO-COLLAGEN","G13","DENIED",["R-03"],description="Plain listing",language="en")
    case(12,"DEMO-COLLAGEN","G13","APPROVED",title="หายใจสะดวก ส่งไว สินค้าไม่หาย")
    case(13,"DEMO-SLIM","G1","DENIED",["R-03"],title="ลดน้ำหนักทันที เห็นผลใน 3 วัน")
    case(14,"DEMO-COLLAGEN","G13","UNKNOWN",simulate_registry_outage=True)
    case(15,"DEMO-SLIM","G1","PENDING",["R-01","R-03"],product_name="Super Slim X",license_holder="Other Demo Co",title="ลดน้ำหนักทันที")
    case(16,"DEMO-SLIM","G1","DENIED",["R-03"],title="ลด 10 กก. ใน 2 สัปดาห์")
    case(17,"DEMO-SLIM","G13","APPROVED",title="ใยอาหาร ควบคู่การออกกำลังกาย")
    case(18,"DEMO-MELON","G2","DENIED",["R-03","R-04"],title="ย้อนกลับเบาหวาน ทานแทนยาได้")
    case(19,"DEMO-MELON","G2","DENIED",["R-03"],"mixed",title="Bitter melon cures diabetes ลดน้ำตาล",advertising_permit=None)
    case(20,"DEMO-LIVER","G3","DENIED",["R-03"],"en",title="prevents liver cancer",description="English description")
    case(21,"DEMO-GINSENG","G4","DENIED",["R-01","R-03"],title="เพิ่มสมรรถภาพทันที")
    case(22,"MISSING","G4","UNKNOWN")
    case(23,"DEMO-VITC","G5","DENIED",["R-03"],title="ป้องกันไวรัส")
    case(24,"DEMO-VITC","G13","APPROVED",title="วิตามินซีมีส่วนช่วยในการทำงานของระบบภูมิคุ้มกัน")
    case(25,"DEMO-JOINT","G6","DENIED",["R-03"],title="รักษาข้อเสื่อม หายปวดเข่าถาวร")
    case(26,"DEMO-GLOW","G7","DENIED",["R-02","R-03"],title="ขาวถาวรใน 7 วัน ย้อนวัย")
    case(27,"DEMO-SUNSCREEN","G7","APPROVED",title="ป้องกันแสงแดด SPF50")
    case(28,"DEMO-KIDS","G8","DENIED",["R-03"],title="เพิ่มความสูงแน่นอน")
    case(29,"DEMO-SLEEP","G9","DENIED",["R-01"],title="")
    case(30,"DEMO-TONIC","G10","DENIED",["R-02"],category="supplement",description=TERM)
    case(31,"DEMO-WHEY","G11","DENIED",["R-03"],"en",description="English-only label")
    case(32,"FOREIGN-DEMO","G12","UNKNOWN",registry_source="foreign")
    case(33,"DEMO-OAT","G13","APPROVED")
    case(34,"DEMO-OAT","G13","APPROVED",title="Legitimate reseller",language="mixed")
    case(35,"DEMO-OAT","G1","PENDING",["R-01","R-04"],license_holder="Other Demo Trader",advertising_permit="DEMO-AD-CONFLICT")
    case(36,"SPACED-DEMO","G12","UNKNOWN")
    case(37,"TYPO-DEMO","G12","UNKNOWN")
    case(38,"DEMO-MELON","G2","PENDING",["R-04"])
    case(39,"DEMO-JOINT","G6","PENDING",["R-04"],advertising_permit=None)
    case(40,"DEMO-MELON","G2","UNKNOWN",title="ย้อนกลับเบาหวาน",simulate_registry_outage=True)
    # Rules may still report advertising failures during an outage; the decision remains UNKNOWN.
    listings["L40"]["expected_failures"] = ["R-03"]
    evidence = {}
    kinds = ["identity_mismatch","identity_match","empty_file","stale_hash","label_match","missing_thai_term",
        "certificate_match","holder_mismatch","GMP","ISO 22000","ISO 9001","expired_standard",
        "coa_below","coa_above","permit_mismatch","duplicate_hash"]
    for number, kind in enumerate(kinds, 1):
        evidence["E" + str(number)] = dict(kind=kind, synthetic=True, content="Synthetic evidence " + kind,
            expected="roadmap" if kind.startswith("coa_") else "reject" if kind in {"empty_file","stale_hash"} else
            "fail" if kind in {"identity_mismatch","missing_thai_term","holder_mismatch","ISO 9001","expired_standard","permit_mismatch"} else
            "risk_signal" if kind=="duplicate_hash" else "pass")
    write("registry.json",registry)
    write("listings.json",listings)
    write("evidence_fixtures.json",evidence)
    rules = json.loads((DATA / "claim_rules.json").read_text(encoding="utf-8"))
    rules["thai_phrases"] = list(dict.fromkeys(rules["thai_phrases"] + [
        "ยารักษาความดัน", "ลดน้ำหนักทันที", "เห็นผลใน 3 วัน", "ลด 10 กก. ใน 2 สัปดาห์",
        "ทานแทนยา", "เพิ่มสมรรถภาพทันที", "ป้องกันไวรัส", "รักษาข้อเสื่อม",
        "หายปวดเข่าถาวร", "ขาวถาวรใน 7 วัน", "เพิ่มความสูงแน่นอน", "ล้างพิษตับ",
        "ฟื้นฟูตับอักเสบ", "รักษาหย่อนสมรรถภาพ", "ฆ่าเชื้อโควิด", "รักษาสมาธิสั้น",
        "รักษาโรคนอนไม่หลับ", "หายเครียดถาวร", "รักษาความดัน", "ขับนิ่ว", "เพิ่มกล้ามทันที",
    ]))
    write("claim_rules.json", rules)


if __name__ == "__main__":
    generate()
