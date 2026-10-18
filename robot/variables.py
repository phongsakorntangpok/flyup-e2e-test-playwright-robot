"""ตัวแปรของ Robot Framework — อ่านค่าจาก .env และ shared/test-data.json (ใช้ร่วมกับ playwright/)"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:  # ถ้าไม่ได้ติดตั้ง python-dotenv ให้ใช้ environment variables ของเครื่องแทน
    pass

BASE_URL = os.getenv("BASE_URL", "https://www.fly-up.app").rstrip("/")
PIONEER_EMAIL = os.getenv("PIONEER_EMAIL", "")
PIONEER_PASSWORD = os.getenv("PIONEER_PASSWORD", "")
API_BASE_URL = os.getenv("API_BASE_URL", "").rstrip("/")
HEADLESS = os.getenv("HEADLESS", "true").lower() != "false"

API_JS = (ROOT / "shared" / "flyup-api.js").read_text(encoding="utf-8")
_DATA = json.loads((ROOT / "shared" / "test-data.json").read_text(encoding="utf-8"))

MAX_DRAFT_PROJECTS = _DATA["maxDraftProjects"]
BLOCKING_STATES = _DATA["blockingStates"]
PROJECT = _DATA["project"]
MILESTONES = _DATA["project"]["milestones"]
INVALID = _DATA["invalid"]
FAQ = _DATA["faq"]
TEXT = _DATA["text"]
