// Helper สำหรับเทสต์ FlyUp (Pioneer) — logic เดียวกับ robot/resources/flyup.resource
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const SHARED = path.resolve(__dirname, '../../../shared');
const API_JS = fs.readFileSync(path.join(SHARED, 'flyup-api.js'), 'utf8');
const DATA = JSON.parse(fs.readFileSync(path.join(SHARED, 'test-data.json'), 'utf8'));
const TEXT = DATA.text;

// ---------- selectors (ตรงกับ robot/resources/flyup.resource) ----------
const SEL = {
  title: '[data-testid="basics-title-input"]',
  description: '[data-testid="basics-description-input"]',
  categoryDropdown: '[data-testid="basics-category-dropdown-btn"]',
  categoryFirstOption: '[data-testid^="basics-category-option-"] >> nth=0',
  fundingGoal: '[data-testid="basics-funding-goal-input"]',
  projectDuration: '[data-testid="basics-project-duration-input"]',
  softCap: '[data-testid="basics-soft-cap-input"]',
  campaignDuration: '[data-testid="basics-campaign-duration-input"]',
  revenueShare: '[data-testid="basics-revenue-share-input"]',
  minInvest: 'label:text-is("ลงทุนขั้นต่ำ (บาท)") + input',
  coverInput: '[data-testid="basics-cover-image-input"]',
  coverPreview: 'img[alt="cover"]',
  coverDropzone: '[data-testid="basics-cover-image-dropzone"]',
  imagesInput: '[data-testid="basics-additional-images-input"]',
  videoInput: '[data-testid="basics-video-input"]',
  storyEditor: '.ProseMirror',
  risk: 'p:has-text("ความเสี่ยงของโปรเจกต์") + textarea',
  faqQuestion: '[data-testid="faq-question-input"]',
  faqAnswer: '[data-testid="faq-answer-input"]',
  faqAdd: '[data-testid="faq-add-btn"]',
  milestoneTitle: 'input[maxlength="50"]',
  milestoneDescription: 'textarea[maxlength="5000"]',
  milestoneDuration: 'input[inputmode="numeric"][maxlength="3"]',
  milestoneCriteria1: 'div:has(> span:text-is("1.")) > input',
  agreeCheckbox: 'input[type="checkbox"]',
  step4Confirm: '[data-testid="step4-submit-btn"]',
};

// ---------- ไฟล์ทดสอบ ----------
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const FILES = {
  validPng: (name = 'cover.png') => ({ name, mimeType: 'image/png', buffer: PNG_1PX }),
  largePng: (mb) => ({ name: `large-${mb}mb.png`, mimeType: 'image/png', buffer: Buffer.alloc(mb * 1024 * 1024, 1) }),
  gif: () => ({ name: 'cover.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') }),
  largeMp4: (mb) => ({ name: `large-${mb}mb.mp4`, mimeType: 'video/mp4', buffer: Buffer.alloc(mb * 1024 * 1024, 1) }),
};

function credentials() {
  const email = process.env.PIONEER_EMAIL;
  const password = process.env.PIONEER_PASSWORD;
  if (!email || !password) {
    throw new Error('กรุณาตั้งค่า PIONEER_EMAIL และ PIONEER_PASSWORD ในไฟล์ .env ที่ root ของโปรเจกต์');
  }
  return { email, password };
}

/** เรียก shared/flyup-api.js ภายในหน้าเว็บ (ใช้ token/CORS เดียวกับแอป) */
function callApi(page, action, apiBase = null, id = null, payload = null) {
  return page.evaluate(`(${API_JS})(${JSON.stringify({ action, apiBase, id, payload })})`);
}

/** ปิด Cookie banner ล่วงหน้า (เลือก "ปฏิเสธที่ไม่จำเป็น") เพื่อไม่ให้บังปุ่ม */
async function skipCookieBanner(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('flyup_cookie_consent', JSON.stringify({ status: 'declined', version: '1' }));
    } catch (e) { /* ignore */ }
  });
}

async function loginAsPioneer(page) {
  const { email, password } = credentials();
  await page.goto('/login');
  await page.locator('[data-testid="login-email"]').fill(email);
  await page.locator('[data-testid="login-password"]').fill(password);
  await page.locator('[data-testid="login-submit"]').click();
  await expect(page, 'เข้าสู่ระบบไม่สำเร็จ (ยังอยู่หน้า /login)').not.toHaveURL(/\/login/, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('auth_token')), {
    message: 'ไม่พบ auth_token หลังเข้าสู่ระบบ',
  }).toBeTruthy();
}

async function resolveApiBase(page) {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL.replace(/\/$/, '');
  let base = null;
  await expect.poll(async () => (base = await callApi(page, 'detectApiBase')), {
    message: 'หา API base URL ไม่เจอ — ตั้ง API_BASE_URL ใน .env',
  }).toBeTruthy();
  return base;
}

/**
 * Context ต่อหนึ่งเทสต์: login, หา API, เก็บ snapshot และรวม helper ที่ใช้บ่อย
 * ใช้ใน beforeEach/afterEach ของ spec
 */
class FlyUp {
  constructor(page) {
    this.page = page;
    this.apiBase = null;
    this.snapshotIds = null;
    this.createdIds = [];
  }

  async setup() {
    await skipCookieBanner(this.page);
    await loginAsPioneer(this.page);
    this.apiBase = await resolveApiBase(this.page);
    this.snapshotIds = (await this.list()).map((p) => p.id);
  }

  api(action, id = null, payload = null) { return callApi(this.page, action, this.apiBase, id, payload); }
  list() { return this.api('list'); }
  get(id) { return this.api('get', id); }
  milestones(id) { return this.api('milestones', id); }
  faqs(id) { return this.api('faqs', id); }

  async countDrafts() {
    return (await this.list()).filter((p) => p.state === 'draft').length;
  }

  async expectDraftSlot() {
    expect(await this.countDrafts(), 'บัญชีมีแบบร่างครบ 5 แล้ว กรุณาลบแบบร่างเก่าก่อนรันเทสต์')
      .toBeLessThan(DATA.maxDraftProjects);
  }

  async expectNoBlockingProject() {
    const blocking = (await this.list()).filter((p) => DATA.blockingStates.includes(p.state));
    expect(blocking, 'บัญชีมีโปรเจกต์ที่กำลังระดมทุน/ดำเนินการ/รอตรวจสอบอยู่ จึงส่งคำขอใหม่ไม่ได้').toEqual([]);
  }

  async createDraftViaApi() {
    const id = await this.api('create');
    expect(id, 'สร้างแบบร่างผ่าน API ไม่สำเร็จ').toBeTruthy();
    this.createdIds.push(id);
    return id;
  }

  /** Pre-condition: สร้างแบบร่างผ่าน API แล้วตั้งชื่อ (+ ข้อมูลเพิ่มเติม / Milestone ถ้ามี) */
  async prepareDraft(tcId, { update = {}, milestones = null } = {}) {
    await this.expectDraftSlot();
    const id = await this.createDraftViaApi();
    const title = `AUTO ${tcId}`;
    await this.api('update', id, { title, ...update });
    if (milestones) await this.api('setMilestones', id, milestones);
    return { id, title };
  }

  /** เปิดหน้าใด ๆ ของ wizard แล้วรอให้แอปโหลดข้อมูลโปรเจกต์เสร็จก่อนเริ่มกรอก */
  async openProjectPage(id, step = null) {
    const url = step ? `/project/overview/${id}/step/${step}` : `/project/overview/${id}`;
    const loaded = this.page.waitForResponse(`**/projects/${id}/milestones`, { timeout: 30_000 });
    await this.page.goto(url);
    await loaded;
    await this.page.waitForTimeout(500);
  }

  async openStep1(id, title) {
    await this.openProjectPage(id, 1);
    if (title) await expect(this.page.locator(SEL.title)).toHaveValue(title);
  }

  async openMyProjects() {
    await this.page.goto('/pioneer/dashboard/projects');
    await expect(this.page.getByRole('heading', { name: TEXT.myProjectsHeading })).toBeVisible();
    await expect(this.page.getByRole('button', { name: TEXT.createButton })).toBeEnabled();
  }

  /**
   * คลิก (focus) → พิมพ์ค่า → กด Tab (blur) เพื่อให้แอป auto-save
   * ต้อง focus ก่อน เพราะช่องตัวเลขจะเปลี่ยนจาก "70,000" เป็น "70000" ตอน focus
   */
  async fillAndBlur(selector, value) {
    const input = this.page.locator(selector);
    await input.click();
    await input.fill(String(value));
    await input.press('Tab');
  }

  /**
   * ทำ action แล้วรอ response ของการบันทึก (POST/PATCH ที่ path ตรงกับ pathRegex)
   * ถ้า backend ตอบ error จะ fail พร้อมแสดงข้อความจาก backend
   */
  async waitForSave(pathRegex, action, what) {
    const saved = this.page.waitForResponse((r) =>
      pathRegex.test(new URL(r.url()).pathname) && ['POST', 'PATCH'].includes(r.request().method()),
    { timeout: 15_000 });
    await action();
    let res;
    try {
      res = await saved;
    } catch (e) {
      throw new Error(`ไม่พบคำขอบันทึก ${what} ภายใน 15 วินาที (แอปไม่ได้ส่งข้อมูลไป backend)`);
    }
    expect(res.ok(), `บันทึก ${what} ไม่สำเร็จ: ${res.request().method()} ${res.url()} -> HTTP ${res.status()} ${await res.text()}`)
      .toBe(true);
  }

  /** กรอกช่องใน Step 1 แล้วรอ PATCH /pioneer/projects/{id} */
  fillProjectFieldAndWaitSave(id, selector, value) {
    return this.waitForSave(new RegExp(`/pioneer/projects/${id}$`), () => this.fillAndBlur(selector, value), `ช่อง ${selector}`);
  }

  /** กรอกช่องของ Milestone แล้วรอ POST/PATCH .../milestones */
  fillMilestoneFieldAndWaitSave(selector, value) {
    return this.waitForSave(/\/milestones(\/\d+)?$/, () => this.fillAndBlur(selector, value), `Milestone ${selector}`);
  }

  /**
   * Step 1: กรอกข้อมูลพื้นฐานทั้งหมดตาม test-data ทีละช่อง และรอให้ backend บันทึกแต่ละช่อง
   * @returns ชื่อหมวดหมู่ที่เลือก
   */
  async fillStep1Basics(id) {
    const P = DATA.project;
    await this.fillProjectFieldAndWaitSave(id, SEL.title, P.title);
    await this.fillProjectFieldAndWaitSave(id, SEL.description, P.description);
    await this.page.locator(SEL.categoryDropdown).click();
    const option = this.page.locator(SEL.categoryFirstOption);
    const category = (await option.innerText()).trim();
    await this.waitForSave(new RegExp(`/pioneer/projects/${id}$`), () => option.click(), 'หมวดหมู่');
    await this.fillProjectFieldAndWaitSave(id, SEL.fundingGoal, P.fundingGoal);
    await this.fillProjectFieldAndWaitSave(id, SEL.projectDuration, P.projectDurationMonths);
    await this.fillProjectFieldAndWaitSave(id, SEL.campaignDuration, P.campaignDays);
    await this.fillProjectFieldAndWaitSave(id, SEL.revenueShare, P.profitSharePct);
    return category;
  }

  /**
   * ตรวจว่า Milestone ถูกบันทึกใน backend (เทียบจากชื่อและระยะเวลา)
   * fail พร้อมแสดงรายการ Milestone ที่ backend มีจริง เพื่อดูว่า Phase ไหนหาย
   */
  async expectMilestoneSaved(id, label, milestone, all = null) {
    const expected = all || [milestone];
    let actual = [];
    try {
      await expect.poll(async () => {
        actual = await this.milestones(id);
        return expected.every((m) => actual.some((a) => a.title === m.title && a.duration === m.duration));
      }, { timeout: 20_000 }).toBe(true);
    } catch (e) {
      throw new Error(`Milestone Phase ${label} ไม่ถูกบันทึกใน backend\nที่ backend มีจริง: ${JSON.stringify(actual)}`);
    }
  }

  toast(text) {
    return this.page.locator('[role="status"]', { hasText: text });
  }

  draftStatCount() {
    return this.page
      .locator('button', { has: this.page.locator('span', { hasText: new RegExp(`^${TEXT.draftLabel}$`) }) })
      .locator('span')
      .first();
  }

  submitButton() {
    return this.page.getByRole('button', { name: TEXT.submitButton });
  }

  /** รอจนค่าใน backend ตรงตามที่คาด (auto-save เป็น async) */
  async expectProject(id, expected) {
    await expect.poll(async () => {
      const p = await this.get(id);
      return Object.fromEntries(Object.keys(expected).map((k) => [k, p[k]]));
    }, { timeout: 15_000, message: 'ข้อมูลโปรเจกต์ใน backend ไม่ตรงตามที่คาด' }).toEqual(expected);
  }

  /**
   * Post-condition: ลบโปรเจกต์ที่เทสต์สร้าง (id ที่บันทึกไว้ + แบบร่าง/รอตรวจสอบใหม่ที่ไม่อยู่ใน snapshot)
   * แล้วตรวจซ้ำว่าลบจริง
   */
  async cleanup() {
    if (!this.apiBase || !this.snapshotIds) return [];
    const current = await this.list();
    const leaked = current
      .filter((p) => ['draft', 'pending_review'].includes(p.state) && !this.snapshotIds.includes(p.id))
      .map((p) => p.id);
    const targets = [...new Set([...this.createdIds, ...leaked])];
    for (const id of targets) {
      const result = await this.api('delete', id);
      console.log(`[cleanup] DELETE project ${id} (${result.stateBefore}) -> HTTP ${result.status}`);
    }
    const remaining = (await this.list()).map((p) => p.id);
    const notDeleted = targets.filter((id) => remaining.includes(id));
    expect(notDeleted, `ลบโปรเจกต์ที่เทสต์สร้างไม่สำเร็จ: ${notDeleted.join(', ')}`).toEqual([]);
    return targets;
  }
}

module.exports = { FlyUp, DATA, TEXT, SEL, FILES };
