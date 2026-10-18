"""สร้างไฟล์ทดสอบสำหรับอัปโหลด (เหมือน FILES ใน playwright/tests/support/flyup.js)"""
import base64
from pathlib import Path

from robot.libraries.BuiltIn import BuiltIn

PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def _target(name: str) -> Path:
    folder = Path(BuiltIn().get_variable_value("${OUTPUT DIR}")) / "test-files"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / name


def create_valid_png(name: str = "cover.png") -> str:
    """รูป PNG ขนาด 1x1 px (ไฟล์ที่ถูกต้อง)"""
    path = _target(name)
    path.write_bytes(PNG_1PX)
    return str(path)


def create_large_file(name: str, size_mb) -> str:
    """ไฟล์ขนาด size_mb เมกะไบต์ (ใช้ทดสอบเกินขนาด) — ชนิดไฟล์ดูจากนามสกุลของ name"""
    path = _target(name)
    path.write_bytes(b"\x01" * int(float(size_mb) * 1024 * 1024))
    return str(path)


def create_gif_file(name: str = "cover.gif") -> str:
    """ไฟล์ GIF (นามสกุลที่ระบบไม่รองรับสำหรับรูปปก)"""
    path = _target(name)
    path.write_bytes(b"GIF89a")
    return str(path)
