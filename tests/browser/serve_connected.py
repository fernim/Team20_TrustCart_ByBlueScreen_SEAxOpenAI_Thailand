"""Isolated real-auth application for connected workflow browser tests."""

import sys
import tempfile
from pathlib import Path
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.app.main import create_app

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="trustcart-connected-") as directory:
        uvicorn.run(
            create_app(Path(directory) / "test.sqlite3"), host="127.0.0.1", port=8768
        )
