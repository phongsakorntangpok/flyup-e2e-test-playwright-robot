// US-14 : Pioneer สร้างโปรเจกต์
// เอกสาร: docs/user-story.md และ docs/test-scenarios-and-test-cases.md
//
// โครงของทุก Test Case
//   beforeEach  -> เข้าสู่ระบบ Pioneer + จำรายการโปรเจกต์เดิมของบัญชีไว้ (snapshot)
//   ตัวเทสต์    -> Pre-condition (เตรียมข้อมูลผ่าน API) -> ทำตามขั้นตอนบนหน้าเว็บ -> ตรวจผลทั้งบนหน้าเว็บและใน backend
//   afterEach   -> ลบโปรเจกต์ที่เทสต์สร้างขึ้นทั้งหมด (ระบบให้มีแบบร่างได้ไม่เกิน 5)
const { test, expect } = require('@playwright/test');
const { FlyUp, DATA, TEXT, SEL, FILES } = require('./support/flyup');

// ข้อมูลทดสอบจาก shared/test-data.json (ใช้ชุดเดียวกับ Robot)
const P = DATA.project;   // ข้อมูลโปรเจกต์ที่ถูกต้อง
const INV = DATA.invalid; // ค่าที่ผิดเงื่อนไข สำหรับ negative test

// รันทีละเทสต์ (workers: 1 ใน config) แต่เทสต์ที่ fail จะไม่หยุดเทสต์ถัดไป

/** @type {FlyUp} */
let flyup;

// ก่อนทุกเทสต์: login ด้วยบัญชีใน .env, หา URL ของ API และจำรายการโปรเจกต์ที่มีอยู่แล้ว
test.beforeEach(async ({ page }) => {
  flyup = new FlyUp(page);
  await flyup.setup();
});

// Post-condition ของทุก Test Case: ลบโปรเจกต์ที่เทสต์สร้างขึ้นทั้งหมด (ทำแม้เทสต์จะ fail)
test.afterEach(async () => {
  await test.step('Post-condition: ลบโปรเจกต์ที่สร้างระหว่างเทสต์', async () => {
    await flyup.cleanup();
  });
});

// ───────────────────────── Scenario-14.1 ─────────────────────────
test.describe('Scenario-14.1 การเข้าถึงและสร้างโปรเจกต์ฉบับร่าง', () => {
  test('TC-14-001 [P] สร้างโปรเจกต์แบบร่างสำเร็จ', { tag: ['@positive', '@TC-14-001'] }, async ({ page }) => {
    // Pre-condition: แบบร่างต้องยังไม่ครบ 5 และจำจำนวนแบบร่างก่อนสร้างไว้เทียบ
    await flyup.expectDraftSlot();
    const draftsBefore = await flyup.countDrafts();

    // เปิดหน้า "โปรเจกต์ของฉัน" แล้วกดปุ่ม "สร้างโปรเจกต์ใหม่"
    await flyup.openMyProjects();
    await page.getByRole('button', { name: TEXT.createButton }).click();

    // ต้องถูกพาไปหน้า /project/overview/{id} — ดึง id จาก URL เก็บไว้ให้ afterEach ลบทิ้ง
    await expect(page).toHaveURL(/\/project\/overview\/\d+$/);
    const id = Number(page.url().match(/\/project\/overview\/(\d+)/)[1]);
    flyup.createdIds.push(id);
    await expect(page.getByRole('heading', { name: TEXT.overviewHeading })).toBeVisible();

    // ตรวจใน backend: โปรเจกต์ใหม่เป็น DRAFT และจำนวนแบบร่างเพิ่มขึ้น 1
    expect((await flyup.get(id)).state).toBe('draft');
    expect(await flyup.countDrafts()).toBe(draftsBefore + 1);

    // ตรวจบนหน้าเว็บ: การ์ด "แบบร่าง" แสดงจำนวนใหม่
    await flyup.openMyProjects();
    await expect(flyup.draftStatCount()).toHaveText(String(draftsBefore + 1));
  });

  test('TC-14-002 [N] สร้างโปรเจกต์ไม่ได้เมื่อมีแบบร่างครบ 5 โปรเจกต์', { tag: ['@negative', '@TC-14-002'] }, async ({ page }) => {
    // Pre-condition: สร้างแบบร่างผ่าน API จนครบ 5 (ถ้าบัญชีมีอยู่แล้วบางส่วน จะสร้างเฉพาะที่ขาด)
    for (let i = await flyup.countDrafts(); i < DATA.maxDraftProjects; i++) await flyup.createDraftViaApi();
    const draftsBefore = await flyup.countDrafts();
    expect(draftsBefore).toBeGreaterThanOrEqual(DATA.maxDraftProjects);

    // หน้าเว็บต้องเห็นแบบร่างครบแล้ว จากนั้นลองกดสร้างใหม่
    await flyup.openMyProjects();
    await expect(flyup.draftStatCount()).toHaveText(String(draftsBefore));
    await page.getByRole('button', { name: TEXT.createButton }).click();

    // ต้องขึ้นข้อความแจ้งเตือน, อยู่หน้าเดิม และไม่มีโปรเจกต์ใหม่เกิดขึ้น
    await expect(flyup.toast(TEXT.toastDraftLimit)).toBeVisible();
    await expect(page).toHaveURL(/\/pioneer\/dashboard\/projects$/);
    expect(await flyup.countDrafts()).toBe(draftsBefore);
  });
});

// ───────────────────────── Scenario-14.2 ─────────────────────────
test.describe('Scenario-14.2 กรอกข้อมูลพื้นฐานโปรเจกต์ (Step 1)', () => {
  test('TC-14-003 [P] กรอกข้อมูลพื้นฐานครบถ้วนและบันทึกอัตโนมัติ', { tag: ['@positive', '@TC-14-003'] }, async ({ page }) => {
    // Pre-condition: สร้างแบบร่างชื่อ "AUTO TC-14-003" ผ่าน API แล้วเปิด Step 1 (รอจนหน้าโหลดชื่อนี้ขึ้นมา)
    const { id, title } = await flyup.prepareDraft('TC-14-003');
    await flyup.openStep1(id, title);

    // กรอกชื่อ, คำอธิบาย, หมวดหมู่, เป้าหมาย, ระยะเวลา, ระดมทุน, ส่วนแบ่งกำไร — รอ backend บันทึกทีละช่อง
    const category = await flyup.fillStep1Basics(id);

    // ระบบคำนวณ Soft Cap (70%) และยอดลงทุนขั้นต่ำ (1%) อัตโนมัติ
    await expect(page.locator(SEL.softCap)).toHaveValue(P.expectedSoftCapText);
    await expect(page.locator(SEL.minInvest)).toHaveValue(P.expectedMinInvestText);

    // ตรวจใน backend ว่าทุกช่องถูกบันทึกตรงกับที่กรอก และยังเป็น DRAFT
    await flyup.expectProject(id, {
      state: 'draft',
      title: P.title,
      description: P.description,
      category,
      fundingGoal: P.fundingGoal,
      softCap: P.expectedSoftCap,
      durationMonths: P.projectDurationMonths,
      campaignDays: P.campaignDays,
      profitSharePct: P.profitSharePct,
    });
  });

  test('TC-14-004 [N] เป้าหมายเงินทุนต่ำกว่า 1,000 บาท', { tag: ['@negative', '@TC-14-004'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-004');
    await flyup.openStep1(id, title);

    // กรอกเป้าหมาย 500 บาท แล้วออกจากช่อง (Tab)
    await flyup.fillAndBlur(SEL.fundingGoal, INV.fundingGoalBelowMin);

    // ต้องขึ้นข้อความเตือน, ช่องถูกปรับเป็น 1,000 และ backend บันทึก 1,000
    await expect(flyup.toast(TEXT.toastFundingGoalMin)).toBeVisible();
    await expect(page.locator(SEL.fundingGoal)).toHaveValue(INV.fundingGoalMinText);
    await flyup.expectProject(id, { fundingGoal: INV.fundingGoalMin });
  });

  test('TC-14-005 [N] Soft Cap ต่ำกว่า 70% ของเป้าหมายเงินทุน', { tag: ['@negative', '@TC-14-005'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-005');
    await flyup.openStep1(id, title);

    // ตั้งเป้าหมาย 100,000 ก่อน แล้วกรอก Soft Cap 50,000 (ต่ำกว่า 70% = 70,000)
    await flyup.fillAndBlur(SEL.fundingGoal, P.fundingGoal);
    await flyup.fillAndBlur(SEL.softCap, INV.softCapBelow70);

    // ต้องขึ้นข้อความเตือน และ Soft Cap ถูกปรับเป็น 70,000 ทั้งบนหน้าเว็บและใน backend
    await expect(flyup.toast(TEXT.toastSoftCapMin)).toBeVisible();
    await expect(page.locator(SEL.softCap)).toHaveValue(P.expectedSoftCapText);
    await flyup.expectProject(id, { softCap: P.expectedSoftCap });
  });

  test('TC-14-006 [N] ระยะเวลาระดมทุนเกิน 60 วัน', { tag: ['@negative', '@TC-14-006'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-006');
    await flyup.openStep1(id, title);

    // กรอกระยะเวลาระดมทุน 61 วัน (เกินสูงสุด 60)
    await flyup.fillAndBlur(SEL.campaignDuration, INV.campaignDaysOver);

    // ต้องขึ้นข้อความเตือน และค่าถูกปรับเป็น 60 ทั้งบนหน้าเว็บและใน backend
    await expect(flyup.toast(TEXT.toastCampaignRange)).toBeVisible();
    await expect(page.locator(SEL.campaignDuration)).toHaveValue(String(INV.campaignDaysMax));
    await flyup.expectProject(id, { campaignDays: INV.campaignDaysMax });
  });

  test('TC-14-007 [N] ส่วนแบ่งกำไรเกิน 50%', { tag: ['@negative', '@TC-14-007'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-007');
    await flyup.openStep1(id, title);

    // กรอกส่วนแบ่งกำไร 51% (เกินสูงสุด 50%)
    await flyup.fillAndBlur(SEL.revenueShare, INV.profitSharePctOver);

    // ต้องขึ้นข้อความเตือน และค่าถูกปรับเป็น 50 ทั้งบนหน้าเว็บและใน backend
    await expect(flyup.toast(TEXT.toastProfitShareMax)).toBeVisible();
    await expect(page.locator(SEL.revenueShare)).toHaveValue(String(INV.profitSharePctMax));
    await flyup.expectProject(id, { profitSharePct: INV.profitSharePctMax });
  });
});

// ───────────────────────── Scenario-14.3 ─────────────────────────
test.describe('Scenario-14.3 อัปโหลดสื่อประกอบ (Step 1)', () => {
  test('TC-14-008 [N] รูปภาพปกขนาดเกิน 5MB', { tag: ['@negative', '@TC-14-008'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-008');
    await flyup.openStep1(id, title);

    // เลือกไฟล์ .png ขนาด 6MB (สร้างในหน่วยความจำ ไม่ต้องมีไฟล์จริง) ใส่ช่องรูปปก
    await page.locator(SEL.coverInput).setInputFiles(FILES.largePng(INV.coverTooLargeMB));

    // ต้องขึ้นข้อความเตือน, ไม่มีรูปปกแสดง (ยังเป็นช่องอัปโหลด) และ backend ไม่มีรูปปก
    await expect(flyup.toast(TEXT.toastImageTooLarge)).toBeVisible();
    await expect(page.locator(SEL.coverDropzone)).toBeVisible();
    await expect(page.locator(SEL.coverPreview)).toHaveCount(0);
    await flyup.expectProject(id, { coverImage: '' });
  });

  test('TC-14-009 [N] รูปภาพปกนามสกุลไม่รองรับ', { tag: ['@negative', '@TC-14-009'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-009');
    await flyup.openStep1(id, title);

    // เลือกไฟล์ .gif (รองรับแค่ PNG / JPEG / WEBP) ใส่ช่องรูปปก
    await page.locator(SEL.coverInput).setInputFiles(FILES.gif());

    // ต้องขึ้นข้อความเตือน, ไม่มีรูปปกแสดง และ backend ไม่มีรูปปก
    await expect(flyup.toast(TEXT.toastImageType)).toBeVisible();
    await expect(page.locator(SEL.coverDropzone)).toBeVisible();
    await expect(page.locator(SEL.coverPreview)).toHaveCount(0);
    await flyup.expectProject(id, { coverImage: '' });
  });

  test('TC-14-010 [N] วิดีโอขนาดเกิน 10MB', { tag: ['@negative', '@TC-14-010'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-010');
    await flyup.openStep1(id, title);

    // เลือกไฟล์ .mp4 ขนาด 11MB ใส่ช่องวิดีโอ
    await page.locator(SEL.videoInput).setInputFiles(FILES.largeMp4(INV.videoTooLargeMB));

    // ต้องขึ้นข้อความเตือน, ตัวนับยังเป็น "0/1 ไฟล์" และ backend ไม่มีวิดีโอ
    await expect(flyup.toast(TEXT.toastVideoTooLarge)).toBeVisible();
    await expect(page.getByText(TEXT.videoCounterEmpty, { exact: true })).toBeVisible();
    await flyup.expectProject(id, { videoCount: 0 });
  });
});

// ───────────────────────── Scenario-14.4 ─────────────────────────
test.describe('Scenario-14.4 เรื่องราวและคำถามที่พบบ่อย (Step 2)', () => {
  test('TC-14-011 [N] เพิ่ม FAQ โดยไม่กรอกคำตอบ', { tag: ['@negative', '@TC-14-011'] }, async ({ page }) => {
    // Pre-condition: แบบร่างใหม่ แล้วเปิด Step 2
    const { id } = await flyup.prepareDraft('TC-14-011');
    await flyup.openProjectPage(id, 2);

    // กรอกเฉพาะคำถาม (เว้นคำตอบว่าง) แล้วกด "เพิ่ม FAQ"
    await page.locator(SEL.faqQuestion).fill(DATA.faq.question);
    await page.locator(SEL.faqAdd).click();

    // ต้องขึ้นข้อความเตือน, คำถามยังค้างอยู่ในช่อง และ backend ไม่มี FAQ ถูกบันทึก
    await expect(flyup.toast(TEXT.toastFaqRequired)).toBeVisible();
    await expect(page.locator(SEL.faqQuestion)).toHaveValue(DATA.faq.question);
    expect(await flyup.faqs(id)).toHaveLength(0);
  });
});

// ───────────────────────── Scenario-14.5 ─────────────────────────
test.describe('Scenario-14.5 กำหนด Milestone (Step 3)', () => {
  test('TC-14-012 [N] ระยะเวลา Milestone รวมเกินระยะเวลาโปรเจกต์', { tag: ['@negative', '@TC-14-012'] }, async ({ page }) => {
    // Pre-condition: แบบร่างที่ตั้งระยะเวลาโปรเจกต์ 1 เดือน (= 30 วัน) ผ่าน API แล้วเปิด Step 3
    const { id } = await flyup.prepareDraft('TC-14-012', {
      update: { duration_months: INV.milestoneProjectDurationMonths },
    });
    await flyup.openProjectPage(id, 3);

    // กรอกระยะเวลา Phase 1 = 40 วัน (เกิน 30 วันของโปรเจกต์)
    await flyup.fillAndBlur(SEL.milestoneDuration, INV.milestoneDurationOver);

    // ต้องขึ้นข้อความเตือน และระยะเวลาถูกปรับเป็น 30 วันทั้งบนหน้าเว็บและใน backend
    await expect(flyup.toast(TEXT.toastMilestoneClamp)).toBeVisible();
    await expect(page.locator(SEL.milestoneDuration)).toHaveValue(String(INV.milestoneDurationClamped));
    await expect.poll(async () => ((await flyup.milestones(id)).find((m) => m.phase === 1) || {}).duration, {
      timeout: 15_000,
    }).toBe(INV.milestoneDurationClamped);
  });
});

// ───────────────────────── Scenario-14.6 ─────────────────────────
test.describe('Scenario-14.6 ยืนยันและส่งคำขอสร้างโปรเจกต์ (Step 4)', () => {
  test('TC-14-013 [N] ไม่ติ๊กยอมรับข้อตกลง ปุ่มส่งคำขอกดไม่ได้', { tag: ['@negative', '@TC-14-013'] }, async ({ page }) => {
    // Pre-condition: ไม่มีโปรเจกต์อื่นที่ active (ไม่งั้นปุ่มจะกดไม่ได้ด้วยเหตุผลอื่น)
    // และเตรียมแบบร่างที่กรอก Milestone ครบ 4 Phase ผ่าน API ให้เหลือเงื่อนไขเดียวคือการยอมรับข้อตกลง
    await flyup.expectNoBlockingProject();
    const { id } = await flyup.prepareDraft('TC-14-013', {
      update: { duration_months: P.projectDurationMonths },
      milestones: P.milestones,
    });
    await flyup.openProjectPage(id, 4);

    // ยังไม่ติ๊กยอมรับ -> ปุ่ม "ส่งคำขอสร้างโปรเจกต์" ต้องกดไม่ได้
    const checkbox = page.locator(SEL.agreeCheckbox);
    await expect(checkbox).not.toBeChecked();
    await expect(flyup.submitButton()).toBeDisabled();

    // ยืนยันว่าสาเหตุคือการไม่ยอมรับข้อตกลง: ติ๊กแล้วปุ่มต้องกดได้ (แต่ไม่กดส่งจริง)
    await checkbox.check();
    await expect(flyup.submitButton()).toBeEnabled();
    expect((await flyup.get(id)).state).toBe('draft');
  });

  test('TC-14-014 [N] ข้อมูลไม่ครบถ้วน ปุ่มส่งคำขอในหน้าภาพรวมกดไม่ได้', { tag: ['@negative', '@TC-14-014'] }, async ({ page }) => {
    // Pre-condition: แบบร่างที่มีแค่ชื่อ แล้วเปิดหน้าภาพรวมของโปรเจกต์
    const { id } = await flyup.prepareDraft('TC-14-014');
    await flyup.openProjectPage(id);

    // ข้อมูลยังไม่ครบ -> ปุ่มส่งคำขอต้องกดไม่ได้ และโปรเจกต์ยังเป็น DRAFT
    await expect(page.getByRole('heading', { name: TEXT.overviewHeading })).toBeVisible();
    await expect(flyup.submitButton()).toBeDisabled();
    expect((await flyup.get(id)).state).toBe('draft');
  });

  test('TC-14-015 [P] สร้างและส่งคำขอสร้างโปรเจกต์สำเร็จ (ครบทุกขั้นตอน)', { tag: ['@positive', '@TC-14-015'] }, async ({ page }) => {
    // เทสต์นี้ยาว (อัปโหลดไฟล์ + กรอก 4 step) จึงให้เวลา 4 นาที
    test.setTimeout(240_000);
    // Pre-condition: แบบร่างยังไม่ครบ 5 และไม่มีโปรเจกต์อื่นที่ active (ไม่งั้นส่งคำขอไม่ได้)
    await flyup.expectDraftSlot();
    await flyup.expectNoBlockingProject();

    let id;
    await test.step('1. สร้างโปรเจกต์ใหม่จากหน้า "โปรเจกต์ของฉัน"', async () => {
      // กดสร้างจากหน้าเว็บจริง แล้วดึง id จาก URL เก็บไว้ให้ afterEach ลบทิ้ง
      await flyup.openMyProjects();
      await page.getByRole('button', { name: TEXT.createButton }).click();
      await expect(page).toHaveURL(/\/project\/overview\/\d+$/);
      id = Number(page.url().match(/\/project\/overview\/(\d+)/)[1]);
      flyup.createdIds.push(id);
    });

    await test.step('2. Step 1: กรอกข้อมูลพื้นฐานและอัปโหลดรูปปก + รูปประกอบ', async () => {
      // รอให้หน้าโหลดข้อมูลโปรเจกต์ (ชื่อเริ่มต้นจาก backend) เสร็จก่อนกรอก ไม่งั้นแอปจะเขียนทับค่าที่พิมพ์
      await flyup.openStep1(id, (await flyup.get(id)).title);
      await flyup.fillStep1Basics(id);

      // อัปโหลดรูปปก (PNG 1x1 px) แล้วรอข้อความ "อัปโหลดรูปปกสำเร็จ" และรูปตัวอย่าง
      await page.locator(SEL.coverInput).setInputFiles(FILES.validPng('cover.png'));
      await expect(flyup.toast(TEXT.toastCoverUploaded)).toBeVisible({ timeout: 60_000 });
      await expect(page.locator(SEL.coverPreview)).toBeVisible();

      // อัปโหลดรูปประกอบ 1 รูป แล้วรอข้อความสำเร็จและตัวนับ "1/5 รูป"
      await page.locator(SEL.imagesInput).setInputFiles(FILES.validPng('image-1.png'));
      await expect(flyup.toast(TEXT.toastImagesUploaded)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText('1/5 รูป', { exact: true })).toBeVisible();

      // ตรวจ backend ว่าข้อมูล Step 1 ถูกบันทึกแล้ว จากนั้นกด "ถัดไป" ไป Step 2
      await flyup.expectProject(id, { title: P.title, fundingGoal: P.fundingGoal, imageCount: 1 });
      await page.getByRole('link', { name: TEXT.nextButton }).click();
      await expect(page).toHaveURL(new RegExp(`/project/overview/${id}/step/2$`));
    });

    await test.step('3. Step 2: กรอกเรื่องราวและความเสี่ยง', async () => {
      // พิมพ์เรื่องราวใน Rich Text Editor และกรอกความเสี่ยง
      await page.locator(SEL.storyEditor).click();
      await page.keyboard.type(P.story);
      await flyup.fillAndBlur(SEL.risk, P.risk);
      // รอจน backend บันทึกทั้ง Story และความเสี่ยง (Story บันทึกแบบหน่วงเวลา) แล้วไป Step 3
      await expect.poll(async () => {
        const p = await flyup.get(id);
        return p.story.includes(P.story) && p.risk === P.risk;
      }, { timeout: 15_000, message: 'Story/Risk ไม่ถูกบันทึก' }).toBe(true);
      await page.getByRole('link', { name: TEXT.nextButton }).click();
      await expect(page).toHaveURL(new RegExp(`/project/overview/${id}/step/3$`));
    });

    await test.step('4. Step 3: กรอก Milestone ครบ 4 Phase', async () => {
      for (let i = 0; i < P.milestones.length; i++) {
        const m = P.milestones[i];
        // Phase 1 เปิดอยู่แล้ว ตั้งแต่ Phase 2 ต้องกดแท็บ "Phase N" ก่อน
        if (i > 0) await page.getByRole('button', { name: `Phase ${i + 1}`, exact: true }).click();
        await expect(page.getByRole('heading', { name: `Milestone ${i + 1}`, exact: true })).toBeVisible();
        // รอให้ backend บันทึกเสร็จทีละช่อง (กันการยิง request บันทึกซ้อนกัน)
        await flyup.fillMilestoneFieldAndWaitSave(SEL.milestoneTitle, m.title);
        await flyup.fillMilestoneFieldAndWaitSave(SEL.milestoneDescription, m.description);
        await flyup.fillMilestoneFieldAndWaitSave(SEL.milestoneDuration, m.duration);
        await flyup.fillMilestoneFieldAndWaitSave(SEL.milestoneCriteria1, m.criteria);
        // ตรวจว่า Phase นี้อยู่ใน backend แล้ว (ถ้าไม่อยู่ จะบอกว่า Phase ไหนหาย)
        await flyup.expectMilestoneSaved(id, i + 1, m);
      }
      // ตรวจซ้ำว่าครบทั้ง 4 Phase แล้วไป Step 4
      await flyup.expectMilestoneSaved(id, 'ทั้ง 4 Phase', null, P.milestones);
      await page.getByRole('link', { name: TEXT.nextButton }).click();
      await expect(page).toHaveURL(new RegExp(`/project/overview/${id}/step/4$`));
    });

    await test.step('5. Step 4: ยอมรับข้อตกลงและส่งคำขอ', async () => {
      // ติ๊กยอมรับ -> ปุ่มส่งคำขอต้องกดได้ -> กดส่ง -> กดยืนยัน "ส่งคำขอ" ใน Modal
      await page.locator(SEL.agreeCheckbox).check();
      await expect(flyup.submitButton()).toBeEnabled();
      await flyup.submitButton().click();
      await page.locator(SEL.step4Confirm).click();
    });

    await test.step('6. ระบบเปลี่ยนสถานะเป็น "รอการตรวจสอบ" และพากลับหน้าโปรเจกต์ของฉัน', async () => {
      // ต้องกลับมาหน้า "โปรเจกต์ของฉัน" และ backend เปลี่ยนสถานะเป็น PENDING_REVIEW
      await expect(page).toHaveURL(/\/pioneer\/dashboard\/projects$/, { timeout: 30_000 });
      await flyup.expectProject(id, { state: 'pending_review' });
      // badge สถานะที่อยู่ข้างชื่อโปรเจกต์ในรายการต้องเป็น "รอการตรวจสอบ"
      await expect(page.locator(`h3:text-is("${P.title}") + span`).first()).toHaveText(TEXT.pendingReviewLabel);
    });
    // Post-condition (afterEach): ถอนคำขอให้กลับเป็นแบบร่าง แล้วลบโปรเจกต์
  });
});
