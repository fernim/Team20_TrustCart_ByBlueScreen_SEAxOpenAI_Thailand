from dataclasses import dataclass
from typing import Optional


class RegistryUnavailable(Exception):
    pass


@dataclass(frozen=True)
class RegistryRecord:
    product_name: str
    license_holder: str
    category: str
    active: bool


_FIXTURES = {
    "DEMO-001": RegistryRecord("Vitamin C Supplement", "LumaVale", "supplement", True),
}


def tool_registry_lookup(reference: str) -> Optional[RegistryRecord]:
    return _FIXTURES.get(reference.strip().upper())
