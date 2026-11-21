from dataclasses import dataclass
from typing import Optional
import json
from pathlib import Path


class RegistryUnavailable(Exception):
    pass


@dataclass(frozen=True)
class RegistryRecord:
    product_name: str
    license_holder: str
    category: str
    active: bool


_DATA = Path(__file__).resolve().parent.parent / "data"
_FIXTURES = {
    reference: RegistryRecord(**record)
    for reference, record in json.loads((_DATA / "registry.json").read_text(encoding="utf-8")).items()
}


def demo_listings():
    return json.loads((_DATA / "listings.json").read_text(encoding="utf-8"))


def tool_registry_lookup(reference: str) -> Optional[RegistryRecord]:
    return _FIXTURES.get(reference.strip().upper())
