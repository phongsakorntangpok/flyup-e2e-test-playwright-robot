// US-14 : Pioneer สร้างโปรเจกต์
// เอกสาร: docs/user-story.md และ docs/test-scenarios-and-test-cases.md
const { test, expect } = require('@playwright/test');
const { FlyUp, DATA, TEXT, SEL, FILES } = require('./support/flyup');

const P = DATA.project;
const INV = DATA.invalid;

// รันทีละเทสต์ (workers: 1 ใน config) แต่เทสต์ที่ fail จะไม่หยุดเทสต์ถัดไป

/** @type {FlyUp} */
let flyup;

test.beforeEach(async ({ page }) => {
  flyup = new FlyUp(page);
  await flyup.setup();
});

// Post-condition ของทุก Test Case: ลบโปรเจกต์ที่เทสต์สร้างขึ้นทั้งหมด
test.afterEach(async () => {
  await test.step('Post-condition: ลบโปรเจกต์ที่สร้างระหว่างเทสต์', async () => {
    await flyup.cleanup();
  });
});

// ───────────────────────── Scenario-14.1 ─────────────────────────
test.describe('Scenario-14.1 การเข้าถึงและสร้างโปรเจกต์ฉบับร่าง', () => {
  test('TC-14-001 [P] สร้างโปรเจกต์แบบร่างสำเร็จ', { tag: ['@positive', '@TC-14-001'] }, async ({ page }) => {
    await flyup.expectDraftSlot();
    const draftsBefore = await flyup.countDrafts();

    await flyup.openMyProjects();
    await page.getByRole('button', { name: TEXT.createButton }).click();

    await expect(page).toHaveURL(/\/project\/overview\/\d+$/);
    const id = Number(page.url().match(/\/project\/overview\/(\d+)/)[1]);
    flyup.createdIds.push(id);
    await expect(page.getByRole('heading', { name: TEXT.overviewHeading })).toBeVisible();

    expect((await flyup.get(id)).state).toBe('draft');
    expect(await flyup.countDrafts()).toBe(draftsBefore + 1);

    await flyup.openMyProjects();
    await expect(flyup.draftStatCount()).toHaveText(String(draftsBefore + 1));
  });

  test('TC-14-002 [N] สร้างโปรเจกต์ไม่ได้เมื่อมีแบบร่างครบ 5 โปรเจกต์', { tag: ['@negative', '@TC-14-002'] }, async ({ page }) => {
    for (let i = await flyup.countDrafts(); i < DATA.maxDraftProjects; i++) await flyup.createDraftViaApi();
    const draftsBefore = await flyup.countDrafts();
    expect(draftsBefore).toBeGreaterThanOrEqual(DATA.maxDraftProjects);

    await flyup.openMyProjects();
    await expect(flyup.draftStatCount()).toHaveText(String(draftsBefore));
    await page.getByRole('button', { name: TEXT.createButton }).click();

    await expect(flyup.toast(TEXT.toastDraftLimit)).toBeVisible();
    await expect(page).toHaveURL(/\/pioneer\/dashboard\/projects$/);
    expect(await flyup.countDrafts()).toBe(draftsBefore);
  });
});

// ───────────────────────── Scenario-14.2 ─────────────────────────
test.describe('Scenario-14.2 กรอกข้อมูลพื้นฐานโปรเจกต์ (Step 1)', () => {
  test('TC-14-003 [P] กรอกข้อมูลพื้นฐานครบถ้วนและบันทึกอัตโนมัติ', { tag: ['@positive', '@TC-14-003'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-003');
    await flyup.openStep1(id, title);

    await flyup.fillAndBlur(SEL.title, P.title);
    await flyup.fillAndBlur(SEL.description, P.description);
    await page.locator(SEL.categoryDropdown).click();
    const categoryOption = page.locator(SEL.categoryFirstOption);
    const category = (await categoryOption.innerText()).trim();
    await categoryOption.click();
    await flyup.fillAndBlur(SEL.fundingGoal, P.fundingGoal);
    await flyup.fillAndBlur(SEL.projectDuration, P.projectDurationMonths);
    await flyup.fillAndBlur(SEL.campaignDuration, P.campaignDays);
    await flyup.fillAndBlur(SEL.revenueShare, P.profitSharePct);

    // ระบบคำนวณ Soft Cap (70%) และยอดลงทุนขั้นต่ำ (1%) อัตโนมัติ
    await expect(page.locator(SEL.softCap)).toHaveValue(P.expectedSoftCapText);
    await expect(page.locator(SEL.minInvest)).toHaveValue(P.expectedMinInvestText);

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

    await flyup.fillAndBlur(SEL.fundingGoal, INV.fundingGoalBelowMin);

    await expect(flyup.toast(TEXT.toastFundingGoalMin)).toBeVisible();
    await expect(page.locator(SEL.fundingGoal)).toHaveValue(INV.fundingGoalMinText);
    await flyup.expectProject(id, { fundingGoal: INV.fundingGoalMin });
  });

  test('TC-14-005 [N] Soft Cap ต่ำกว่า 70% ของเป้าหมายเงินทุน', { tag: ['@negative', '@TC-14-005'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-005');
    await flyup.openStep1(id, title);

    await flyup.fillAndBlur(SEL.fundingGoal, P.fundingGoal);
    await flyup.fillAndBlur(SEL.softCap, INV.softCapBelow70);

    await expect(flyup.toast(TEXT.toastSoftCapMin)).toBeVisible();
    await expect(page.locator(SEL.softCap)).toHaveValue(P.expectedSoftCapText);
    await flyup.expectProject(id, { softCap: P.expectedSoftCap });
  });

  test('TC-14-006 [N] ระยะเวลาระดมทุนเกิน 60 วัน', { tag: ['@negative', '@TC-14-006'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-006');
    await flyup.openStep1(id, title);

    await flyup.fillAndBlur(SEL.campaignDuration, INV.campaignDaysOver);

    await expect(flyup.toast(TEXT.toastCampaignRange)).toBeVisible();
    await expect(page.locator(SEL.campaignDuration)).toHaveValue(String(INV.campaignDaysMax));
    await flyup.expectProject(id, { campaignDays: INV.campaignDaysMax });
  });

  test('TC-14-007 [N] ส่วนแบ่งกำไรเกิน 50%', { tag: ['@negative', '@TC-14-007'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-007');
    await flyup.openStep1(id, title);

    await flyup.fillAndBlur(SEL.revenueShare, INV.profitSharePctOver);

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

    await page.locator(SEL.coverInput).setInputFiles(FILES.largePng(INV.coverTooLargeMB));

    await expect(flyup.toast(TEXT.toastImageTooLarge)).toBeVisible();
    await expect(page.locator(SEL.coverDropzone)).toBeVisible();
    await expect(page.locator(SEL.coverPreview)).toHaveCount(0);
    await flyup.expectProject(id, { coverImage: '' });
  });

  test('TC-14-009 [N] รูปภาพปกนามสกุลไม่รองรับ', { tag: ['@negative', '@TC-14-009'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-009');
    await flyup.openStep1(id, title);

    await page.locator(SEL.coverInput).setInputFiles(FILES.gif());

    await expect(flyup.toast(TEXT.toastImageType)).toBeVisible();
    await expect(page.locator(SEL.coverDropzone)).toBeVisible();
    await expect(page.locator(SEL.coverPreview)).toHaveCount(0);
    await flyup.expectProject(id, { coverImage: '' });
  });

  test('TC-14-010 [N] วิดีโอขนาดเกิน 10MB', { tag: ['@negative', '@TC-14-010'] }, async ({ page }) => {
    const { id, title } = await flyup.prepareDraft('TC-14-010');
    await flyup.openStep1(id, title);

    await page.locator(SEL.videoInput).setInputFiles(FILES.largeMp4(INV.videoTooLargeMB));

    await expect(flyup.toast(TEXT.toastVideoTooLarge)).toBeVisible();
    await expect(page.getByText(TEXT.videoCounterEmpty, { exact: true })).toBeVisible();
    await flyup.expectProject(id, { videoCount: 0 });
  });
});

// ───────────────────────── Scenario-14.4 ─────────────────────────
test.describe('Scenario-14.4 เรื่องราวและคำถามที่พบบ่อย (Step 2)', () => {
  test('TC-14-011 [N] เพิ่ม FAQ โดยไม่กรอกคำตอบ', { tag: ['@negative', '@TC-14-011'] }, async ({ page }) => {
    const { id } = await flyup.prepareDraft('TC-14-011');
    await flyup.openProjectPage(id, 2);

    await page.locator(SEL.faqQuestion).fill(DATA.faq.question);
    await page.locator(SEL.faqAdd).click();

    await expect(flyup.toast(TEXT.toastFaqRequired)).toBeVisible();
    await expect(page.locator(SEL.faqQuestion)).toHaveValue(DATA.faq.question);
    expect(await flyup.faqs(id)).toHaveLength(0);
  });
});

// ───────────────────────── Scenario-14.5 ─────────────────────────
test.describe('Scenario-14.5 กำหนด Milestone (Step 3)', () => {
  test('TC-14-012 [N] ระยะเวลา Milestone รวมเกินระยะเวลาโปรเจกต์', { tag: ['@negative', '@TC-14-012'] }, async ({ page }) => {
    const { id } = await flyup.prepareDraft('TC-14-012', {
      update: { duration_months: INV.milestoneProjectDurationMonths },
    });
    await flyup.openProjectPage(id, 3);

    await flyup.fillAndBlur(SEL.milestoneDuration, INV.milestoneDurationOver);

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
    await flyup.expectNoBlockingProject();
    const { id } = await flyup.prepareDraft('TC-14-013', {
      update: { duration_months: P.projectDurationMonths },
      milestones: P.milestones,
    });
    await flyup.openProjectPage(id, 4);

    const checkbox = page.locator(SEL.agreeCheckbox);
    await expect(checkbox).not.toBeChecked();
    await expect(flyup.submitButton()).toBeDisabled();

    // ยืนยันว่าสาเหตุคือการไม่ยอมรับข้อตกลง: ติ๊กแล้วปุ่มต้องกดได้
    await checkbox.check();
    await expect(flyup.submitButton()).toBeEnabled();
    expect((await flyup.get(id)).state).toBe('draft');
  });

  test('TC-14-014 [N] ข้อมูลไม่ครบถ้วน ปุ่มส่งคำขอในหน้าภาพรวมกดไม่ได้', { tag: ['@negative', '@TC-14-014'] }, async ({ page }) => {
    const { id } = await flyup.prepareDraft('TC-14-014');
    await flyup.openProjectPage(id);

    await expect(page.getByRole('heading', { name: TEXT.overviewHeading })).toBeVisible();
    await expect(flyup.submitButton()).toBeDisabled();
    expect((await flyup.get(id)).state).toBe('draft');
  });

  test('TC-14-015 [P] สร้างและส่งคำขอสร้างโปรเจกต์สำเร็จ (ครบทุกขั้นตอน)', { tag: ['@positive', '@TC-14-015'] }, async ({ page }) => {
    test.setTimeout(240_000);
    await flyup.expectDraftSlot();
    await flyup.expectNoBlockingProject();

    let id;
    await test.step('1. สร้างโปรเจกต์ใหม่จากหน้า "โปรเจกต์ของฉัน"', async () => {
      await flyup.openMyProjects();
      await page.getByRole('button', { name: TEXT.createButton }).click();
      await expect(page).toHaveURL(/\/project\/overview\/\d+$/);
      id = Number(page.url().match(/\/project\/overview\/(\d+)/)[1]);
      flyup.createdIds.push(id);
    });

    await test.step('2. Step 1: กรอกข้อมูลพื้นฐานและอัปโหลดรูปปก + รูปประกอบ', async () => {
      await flyup.openProjectPage(id, 1);
      await flyup.fillAndBlur(SEL.title, P.title);
      await flyup.fillAndBlur(SEL.description, P.description);
      await page.locator(SEL.categoryDropdown).click();
      await page.locator(SEL.categoryFirstOption).click();
      await flyup.fillAndBlur(SEL.fundingGoal, P.fundingGoal);
      await flyup.fillAndBlur(SEL.projectDuration, P.projectDurationMonths);
      await flyup.fillAndBlur(SEL.campaignDuration, P.campaignDays);
      await flyup.fillAndBlur(SEL.revenueShare, P.profitSharePct);

      await page.locator(SEL.coverInput).setInputFiles(FILES.validPng('cover.png'));
      await expect(flyup.toast(TEXT.toastCoverUploaded)).toBeVisible({ timeout: 60_000 });
      await expect(page.locator(SEL.coverPreview)).toBeVisible();

      await page.locator(SEL.imagesInput).setInputFiles(FILES.validPng('image-1.png'));
      await expect(flyup.toast(TEXT.toastImagesUploaded)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText('1/5 รูป', { exact: true })).toBeVisible();

      await flyup.expectProject(id, { title: P.title, fundingGoal: P.fundingGoal, imageCount: 1 });
      await page.getByRole('link', { name: TEXT.nextButton }).click();
      await expect(page).toHaveURL(new RegExp(`/project/overview/${id}/step/2$`));
    });

    await test.step('3. Step 2: กรอกเรื่องราวและความเสี่ยง', async () => {
      await page.locator(SEL.storyEditor).click();
      await page.keyboard.type(P.story);
      await flyup.fillAndBlur(SEL.risk, P.risk);
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
        if (i > 0) await page.getByRole('button', { name: `Phase ${i + 1}`, exact: true }).click();
        await expect(page.getByRole('heading', { name: `Milestone ${i + 1}`, exact: true })).toBeVisible();
        await flyup.fillAndBlur(SEL.milestoneTitle, m.title);
        await flyup.fillAndBlur(SEL.milestoneDescription, m.description);
        await flyup.fillAndBlur(SEL.milestoneDuration, m.duration);
        await flyup.fillAndBlur(SEL.milestoneCriteria1, m.criteria);
      }
      await expect.poll(async () => (await flyup.milestones(id))
        .filter((m) => m.title && m.duration > 0).length, { timeout: 20_000 }).toBe(4);
      await page.getByRole('link', { name: TEXT.nextButton }).click();
      await expect(page).toHaveURL(new RegExp(`/project/overview/${id}/step/4$`));
    });

    await test.step('5. Step 4: ยอมรับข้อตกลงและส่งคำขอ', async () => {
      await page.locator(SEL.agreeCheckbox).check();
      await expect(flyup.submitButton()).toBeEnabled();
      await flyup.submitButton().click();
      await page.locator(SEL.step4Confirm).click();
    });

    await test.step('6. ระบบเปลี่ยนสถานะเป็น "รอการตรวจสอบ" และพากลับหน้าโปรเจกต์ของฉัน', async () => {
      await expect(page).toHaveURL(/\/pioneer\/dashboard\/projects$/, { timeout: 30_000 });
      await flyup.expectProject(id, { state: 'pending_review' });
      // badge สถานะที่อยู่ข้างชื่อโปรเจกต์ในรายการ
      await expect(page.locator(`h3:text-is("${P.title}") + span`).first()).toHaveText(TEXT.pendingReviewLabel);
    });
  });
});
