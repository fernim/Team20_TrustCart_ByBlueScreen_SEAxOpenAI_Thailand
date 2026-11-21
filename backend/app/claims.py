"""Small, deterministic R-03 demo policy; not a complete regulatory rule pack."""
import re
from typing import List

from pydantic import BaseModel


class ClaimFinding(BaseModel):
    rule_id: str = "R-03"
    code: str
    source: str
    phrase: str
    reason_th: str
    reason_en: str


# Match claim phrases, never product IDs, brand names, or a bare concentration percentage.
_RULES = [
    (
        "rapid_appearance_change",
        r"ผิวดูอ่อนวัยใน\s*[0-9๐-๙]+\s*วัน|younger[- ]looking skin in\s*\d+\s*days?",
        "อ้างการเปลี่ยนแปลงรูปลักษณ์ภายในระยะเวลาสั้นที่ระบุแน่นอน",
        "Promises an appearance change within a fixed short timeframe.",
    ),
    (
        "instant_effect",
        r"ผิวกระจ่างใสทันที(?:\s*100%)?|ความจำดีขึ้นทันที|instantly brighter skin|instantly better memory",
        "อ้างผลลัพธ์ทันทีจากผลิตภัณฑ์เสริมอาหาร",
        "Promises an immediate effect from a supplement.",
    ),
    (
        "guaranteed_results",
        r"เห็นผลแน่นอนทุกคน|เห็นผลทุกคนโดยไม่มีข้อยกเว้น|100%\s*guaranteed|guaranteed for everyone",
        "รับประกันผลลัพธ์แบบแน่นอนหรือเหมารวมว่าทุกคนจะได้ผล",
        "Guarantees results or promises the same outcome for everyone.",
    ),
]


def find_overclaims(title: str, description: str) -> List[ClaimFinding]:
    findings = []
    for source, text in (("title", title), ("description", description)):
        for code, pattern, reason_th, reason_en in _RULES:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                findings.append(ClaimFinding(
                    code=code, source=source, phrase=match.group(0),
                    reason_th=reason_th, reason_en=reason_en,
                ))
    return findings
