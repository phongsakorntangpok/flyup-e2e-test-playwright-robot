# FlyUp E2E Tests — Pioneer สร้างโปรเจกต์ (Playwright + Robot Framework)

เทสต์อัตโนมัติสำหรับ **US-14 : Pioneer สร้างโปรเจกต์** บนเว็บ [FlyUp](https://www.fly-up.app)
มี Test Case ชุดเดียวกัน **18 เคส** (Positive 6 / Negative 12 — ทุก Scenario มีทั้ง Positive และ Negative) เขียนไว้ 2 ชุด: **Playwright** และ **Robot Framework** (Browser library ซึ่งใช้ Playwright อยู่ข้างใน)

| Scenario | Test Case |
|---|---|
| 14.1 การเข้าถึงและสร้างแบบร่าง | TC-14-001 [P] สร้างแบบร่างสำเร็จ · TC-14-002 [N] แบบร่างครบ 5 |
| 14.2 ข้อมูลพื้นฐาน (Step 1) | TC-14-003 [P] กรอกครบ + auto-save · TC-14-004 [N] เป้าหมาย < 1,000 · TC-14-005 [N] Soft Cap < 70% · TC-14-006 [N] ระดมทุน > 60 วัน · TC-14-007 [N] ส่วนแบ่งกำไร > 50% |
| 14.3 สื่อประกอบ (Step 1) | TC-14-016 [P] อัปโหลดรูปปก + รูปประกอบสำเร็จ · TC-14-008 [N] รูปปก > 5MB · TC-14-009 [N] รูปปกนามสกุลผิด · TC-14-010 [N] วิดีโอ > 10MB |
| 14.4 เรื่องราว & FAQ (Step 2) | TC-14-017 [P] เพิ่ม FAQ สำเร็จ · TC-14-011 [N] FAQ ไม่กรอกคำตอบ |
| 14.5 Milestone (Step 3) | TC-14-018 [P] กรอก Milestone ครบ 4 Phase สำเร็จ · TC-14-012 [N] ระยะเวลารวมเกินระยะเวลาโปรเจกต์ |
| 14.6 ส่งคำขอ (Step 4) | TC-14-013 [N] ไม่ยอมรับข้อตกลง · TC-14-014 [N] ข้อมูลไม่ครบ · TC-14-015 [P] สร้างและส่งคำขอสำเร็จครบทุกขั้นตอน |

ทุก Test Case **ลบโปรเจกต์ที่ตัวเองสร้างเมื่อจบ** (ทั้งผ่านและไม่ผ่าน) เพราะระบบจำกัดแบบร่างไม่เกิน 5 โปรเจกต์

เอกสาร: [User Story](docs/user-story.md) · [Test Scenario & Test Case](docs/test-scenarios-and-test-cases.md)

## โครงสร้างโปรเจกต์

```text
flyup-test-wright-robot/
├── .env.example                 # ตัวอย่างค่าตั้งค่า (คัดลอกเป็น .env)
├── shared/
│   ├── flyup-api.js             # helper เรียก API (เตรียมข้อมูล / ตรวจผล / ลบข้อมูล) ใช้ร่วมกันทั้ง 2 framework
│   └── test-data.json           # ข้อมูลทดสอบ + ข้อความแจ้งเตือนที่คาดหวัง ใช้ร่วมกันทั้ง 2 framework
├── docs/
│   ├── user-story.md
│   └── test-scenarios-and-test-cases.md
├── playwright/
│   ├── playwright.config.js
│   ├── package.json
│   └── tests/
│       ├── pioneer-create-project.spec.js   # TC-14-001 ถึง TC-14-018
│       └── support/flyup.js                 # login, selectors, helpers, cleanup
└── robot/
    ├── requirements.txt
    ├── setup.bat               # ติดตั้ง Robot ครั้งแรก (Windows)
    ├── run.bat                 # รัน Robot (Windows) เช่น run.bat --include TC-14-001
    ├── variables.py             # อ่านค่าจาก .env และ shared/test-data.json
    ├── resources/
    │   ├── flyup.resource       # keywords: login, selectors, helpers, cleanup
    │   └── TestFiles.py         # สร้างไฟล์ทดสอบ (รูป/วิดีโอ) สำหรับอัปโหลด
    └── tests/
        └── pioneer_create_project.robot     # TC-14-001 ถึง TC-14-018
```

## สิ่งที่ต้องมี

- **Node.js 20+** (ใช้ทั้ง Playwright และ Robot Browser library)
- **Python 3.10+** (สำหรับ Robot Framework)
- บัญชี **Pioneer** ที่ผ่านการยืนยัน Student Card + ID Card และมีบัญชีธนาคารแล้ว
- บัญชีต้องมีแบบร่าง **น้อยกว่า 5** และ (สำหรับ TC-14-013, TC-14-015) **ไม่มีโปรเจกต์ที่กำลังระดมทุน / ดำเนินการ / รอตรวจสอบ**

## 1. ตั้งค่า `.env` (ทำครั้งเดียว ใช้ร่วมกันทั้ง 2 framework)

```powershell
cd C:\projects\flyup-test-wright-robot
copy .env.example .env
```

| ตัวแปร | ความหมาย | ค่าเริ่มต้น |
|---|---|---|
| `BASE_URL` | URL ของเว็บ FlyUp | `https://www.fly-up.app` |
| `PIONEER_EMAIL` | อีเมลบัญชี Pioneer | — |
| `PIONEER_PASSWORD` | รหัสผ่านบัญชี Pioneer | — |
| `API_BASE_URL` | URL ของ backend (เว้นว่างได้ ระบบหาเองจาก request ตอน login) | ว่าง |
| `HEADLESS` | `false` = เปิดหน้าต่าง browser ให้เห็นตอนรัน | `true` |

> `.env` อยู่ใน `.gitignore` แล้ว อย่า commit รหัสผ่านขึ้น git

## 2. Playwright

### ติดตั้ง

```powershell
cd playwright
npm install
npx playwright install chromium
```

### รันทั้งหมด

```powershell
npx playwright test
```

### รันเฉพาะ Test Case เดียว / บางกลุ่ม

```powershell
npx playwright test --grep "@TC-14-001"     # เคสเดียว (เปลี่ยนเลขได้ TC-14-001 ถึง TC-14-018)
npx playwright test --grep "@positive"      # เฉพาะ positive
npx playwright test --grep "@negative"      # เฉพาะ negative
npx playwright test --grep "Scenario-14.2"  # เฉพาะ Scenario
```

### อื่น ๆ

```powershell
npx playwright test --headed      # เปิด browser ให้เห็น
npx playwright test --ui          # โหมด UI
npx playwright show-report        # ดูรายงาน HTML (playwright-report/)
```

ถ้าเทสต์ fail จะมี screenshot, video และ trace อยู่ใน `playwright/test-results/`

## 3. Robot Framework

> คำสั่ง `robot` จะใช้ได้ก็ต่อเมื่อติดตั้งแล้ว **และ** activate venv แล้ว ถ้าขึ้น `'robot' is not recognized` แปลว่ายังไม่ได้ทำ 2 อย่างนี้
> วิธีที่ง่ายที่สุดคือใช้ `setup.bat` / `run.bat` ซึ่งไม่ต้อง activate เอง

### วิธีที่ 1 (แนะนำบน Windows): `setup.bat` + `run.bat`

```bat
cd C:\projects\flyup-test-wright-robot\robot
setup.bat                        :: ติดตั้งครั้งแรกครั้งเดียว (สร้าง .venv, ติดตั้ง package, rfbrowser init chromium chromium-headless-shell)
run.bat                          :: รันทั้งหมด
run.bat --include TC-14-001      :: รันเฉพาะ Test Case เดียว (TC-14-001 ถึง TC-14-018)
run.bat --include negative       :: เฉพาะ negative (หรือ positive / scenario-14.2)
run.bat --variable HEADLESS:False  :: เปิด browser ให้เห็น
```

### วิธีที่ 2: ติดตั้งเอง

**cmd**

```bat
cd C:\projects\flyup-test-wright-robot\robot
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
rfbrowser init chromium chromium-headless-shell
robot --outputdir results tests
```

**PowerShell**

```powershell
cd C:\projects\flyup-test-wright-robot\robot
python -m venv .venv
.venv\Scripts\Activate.ps1          # ถ้าไม่ยอมรัน: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
rfbrowser init chromium chromium-headless-shell
robot --outputdir results tests
```

ครั้งต่อไปเปิด terminal ใหม่ ต้อง activate venv ก่อนทุกครั้ง (`.venv\Scripts\activate.bat` หรือ `Activate.ps1`)
หรือเรียกตรงโดยไม่ activate: `.venv\Scripts\python.exe -m robot --outputdir results tests`

### รันเฉพาะ Test Case เดียว / บางกลุ่ม (หลัง activate venv)

```bat
robot --outputdir results --include TC-14-001 tests       :: เคสเดียว
robot --outputdir results --include positive tests        :: เฉพาะ positive
robot --outputdir results --include negative tests        :: เฉพาะ negative
robot --outputdir results --include scenario-14.2 tests   :: เฉพาะ Scenario
```

ผลลัพธ์อยู่ที่ `robot/results/report.html` และ `robot/results/log.html`

## 4. การลบข้อมูลทดสอบ (Cleanup)

ทุก Test Case ลบเองใน `afterEach` (Playwright) / `Test Teardown` (Robot):

1. ก่อนเริ่มเทสต์ เก็บ snapshot รายการโปรเจกต์ของบัญชีไว้
2. หลังจบเทสต์ ลบโปรเจกต์ที่เทสต์สร้าง + โปรเจกต์ DRAFT / PENDING_REVIEW ใหม่ที่ไม่อยู่ใน snapshot
3. ถ้าโปรเจกต์รอตรวจสอบ (TC-14-015) จะถอนคำขอให้กลับเป็นแบบร่างก่อน
4. ลบ FAQ → Milestone → Story / Media → โปรเจกต์ แล้วตรวจซ้ำว่าหายจริง (ถ้าลบไม่ได้เทสต์จะ fail)

**แบบร่างเดิมของบัญชีจะไม่ถูกลบ**

> TC-14-015 ส่งคำขอสร้างโปรเจกต์จริงก่อนถอนคำขอ — Admin อาจเห็นคำขอนี้ชั่วครู่ และรูปที่อัปโหลด (1x1 px) ไปอยู่บน Cloudinary
> ถ้าไม่ต้องการ ให้ข้ามด้วย `--grep-invert "@TC-14-015"` (Playwright) หรือ `--exclude TC-14-015` (Robot)

## 5. ผลการทดสอบล่าสุด

| สภาพแวดล้อม | Playwright | Robot Framework |
|---|---|---|
| FlyUp frontend (repo `3oomm/flyup`) + API จำลอง | ✅ 18/18 | ✅ 18/18 |
| www.fly-up.app (Production) | ⏳ รอรัน | ⏳ รอรัน |

รายละเอียดอยู่ใน [docs/test-scenarios-and-test-cases.md](docs/test-scenarios-and-test-cases.md)

## 6. แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `กรุณาตั้งค่า PIONEER_EMAIL ...` | ยังไม่ได้สร้าง `.env` หรือยังไม่ได้ใส่ค่า |
| `เข้าสู่ระบบไม่สำเร็จ (ยังอยู่หน้า /login)` | อีเมล/รหัสผ่านผิด หรือบัญชีถูกล็อก |
| `บัญชีมีแบบร่างครบ 5 แล้ว ...` | ลบแบบร่างเก่าในหน้า "โปรเจกต์ของฉัน" ให้เหลือน้อยกว่า 5 |
| `บัญชีมีโปรเจกต์ที่กำลังระดมทุน/ดำเนินการ/รอตรวจสอบอยู่ ...` | TC-14-013 / TC-14-015 ต้องใช้บัญชีที่ไม่มีโปรเจกต์ active |
| ขึ้นกล่อง "ยังไม่พร้อมสร้างโปรเจกต์" | บัญชียังยืนยันตัวตน / บัญชีธนาคารไม่ครบ |
| `หา API base URL ไม่เจอ` | ใส่ `API_BASE_URL` ใน `.env` เป็น URL ของ backend |
| `'robot' is not recognized ...` | ยังไม่ได้ติดตั้ง / ยังไม่ได้ activate venv — รัน `robot\setup.bat` แล้วใช้ `robot\run.bat` |
| `Executable doesn't exist ... chrome-headless-shell` (Robot) | ยังไม่ได้ลง headless browser — รัน `.venv\Scripts\rfbrowser.exe init chromium chromium-headless-shell` ในโฟลเดอร์ `robot` |
| `RF-Browser dependencies not found` | ยังไม่ได้รัน `rfbrowser init chromium chromium-headless-shell` (หรือ `setup.bat`) |
| Executable doesn't exist (Playwright) | รัน `npx playwright install chromium` |
