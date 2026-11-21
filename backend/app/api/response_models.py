from typing import Literal, Optional

from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from ..verification import Listing, Status, Verification, VerificationScope


class RuleResult(TypedDict):
    rule: Literal["R-01", "R-02", "R-03", "R-04", "R-05"]
    result: Literal["pass", "fail", "skip"]
    reason_en: str
    reason_th: str
    evidence: Optional[dict]


class SavedVerificationResponse(Verification):
    rule_results: list[RuleResult] = Field(default_factory=list)


class EvidenceDeclarations(BaseModel):
    product_name: str
    license_holder: str
    registration_reference: str
    standards: Optional[str] = None


class EvidenceRecord(BaseModel):
    kind: Literal["label", "certificate"]
    sha256: str
    declarations: EvidenceDeclarations


class AuditResult(BaseModel):
    valid: bool
    broken_at: Optional[int]


class RiskFactor(BaseModel):
    reason: str
    points: int


class ReviewRisk(BaseModel):
    version: str
    policy_hash: str
    score: int
    tier: Literal["low", "medium", "high"]
    factors: list[RiskFactor]
    calibration: str


class VerificationReport(SavedVerificationResponse):
    listing: Optional[Listing] = Field(description="Saved listing snapshot, if available in the record.")
    evidence: list[EvidenceRecord]
    audit: AuditResult
    risk: ReviewRisk
    synthetic: Literal[True]


class VerificationWidget(BaseModel):
    status: Status
    verification_scope: VerificationScope
    label_en: str
    label_th: str
    report_url: str
    synthetic: Literal[True]


class VerificationComparison(BaseModel):
    products: list[VerificationReport]
    synthetic: Literal[True]
