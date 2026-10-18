/*
 * FlyUp API helper (ใช้ร่วมกันทั้ง Playwright และ Robot Framework)
 *
 * ไฟล์นี้ต้องเป็น "function expression" ตัวเดียว (ห้ามมี ; ปิดท้าย)
 * เพราะถูกเรียกแบบ  (<เนื้อหาไฟล์>)({ action, apiBase, id, payload })  ภายในหน้าเว็บ
 * ทำให้ใช้ token ใน localStorage และ CORS เดียวกับแอปจริง
 *
 * ใช้เตรียมข้อมูล (Pre-condition), ตรวจผลลัพธ์ฝั่ง backend และลบข้อมูลทดสอบ (Post-condition)
 *
 * action:
 *   detectApiBase   หา URL ของ backend จาก request /user/me หรือ /signin ที่แอปยิงไปแล้ว
 *   list            รายการโปรเจกต์ของ Pioneer               -> [{ id, state, title }]
 *   get             รายละเอียดโปรเจกต์ (normalize ชื่อ field)  -> { status, id, state, title, ... }
 *   create          สร้างโปรเจกต์แบบร่าง (DRAFT)              -> id
 *   update          PATCH ข้อมูลพื้นฐาน (payload = field ของ API เช่น funding_goal)
 *   milestones      รายการ Milestone เรียงตาม phase          -> [{ id, phase, title, description, duration, criteria }]
 *   setMilestones   กรอก Milestone ทั้ง 4 Phase (payload = [{ title, description, duration, criteria }])
 *   faqs            รายการ FAQ ของโปรเจกต์
 *   delete          ลบโปรเจกต์ (ถ้ารอตรวจสอบจะถอนคำขอก่อน แล้วลบ FAQ / Milestone / Story / Media / โปรเจกต์)
 */
async ({ action, apiBase, id, payload }) => {
  if (action === 'detectApiBase') {
    const names = performance.getEntriesByType('resource').map((e) => e.name);
    const pattern = new RegExp('/(user/me|signin)([?#].*)?$');
    const hit = names.find((n) => pattern.test(n));
    return hit ? hit.replace(pattern, '') : null;
  }

  if (!apiBase) throw new Error('apiBase is required');
  const token = localStorage.getItem('auth_token');

  const call = async (method, path, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method, headers, credentials: 'include' };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(apiBase + path, init);
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, ok: res.ok, body: json };
  };
  const unwrap = (r) => (r.body && r.body.data !== undefined ? r.body.data : r.body);
  const must = (r, what) => {
    if (!r.ok) throw new Error(what + ' failed: HTTP ' + r.status + ' ' + JSON.stringify(r.body));
    return unwrap(r);
  };
  const mediaType = (m) => (Array.isArray(m.type) ? m.type[0] : m.type);

  const listMilestones = async (projectId) => {
    const r = await call('GET', '/projects/' + projectId + '/milestones');
    const raw = r.ok ? unwrap(r) || [] : [];
    return raw
      .map((m) => ({
        id: m.id,
        phase: m.phase_no,
        title: m.title || '',
        description: m.description || '',
        duration: m.duration || 0,
        criteria: m.acceptance_criteria || '',
      }))
      .sort((a, b) => (a.phase || 0) - (b.phase || 0));
  };

  switch (action) {
    case 'list': {
      const data = must(await call('GET', '/pioneer/projects'), 'GET /pioneer/projects');
      return (data || []).map((p) => ({ id: p.id, state: p.state, title: p.title }));
    }

    case 'get': {
      const r = await call('GET', '/pioneer/projects/' + id);
      if (!r.ok) return { status: r.status, id: null, state: null };
      const d = unwrap(r) || {};
      const media = d.media || [];
      const stories = d.stories || [];
      const category = typeof d.category === 'string' ? d.category : (d.category && d.category.name) || '';
      return {
        status: r.status,
        id: d.id,
        state: d.state,
        title: d.title || '',
        description: d.description || '',
        category,
        fundingGoal: d.funding_goal || 0,
        softCap: d.softcap || 0,
        minInvest: d.min_invest_amount || 0,
        durationMonths: d.duration_months || 0,
        campaignDays: d.duration_days || 0,
        profitSharePct: d.profit_share_pct || 0,
        coverImage: d.cover_image || '',
        risk: d.risk || '',
        imageCount: media.filter((m) => mediaType(m) === 'image').length,
        videoCount: media.filter((m) => mediaType(m) === 'video').length,
        story: stories.map((s) => s.body || '').join(''),
      };
    }

    case 'create': {
      const r = await call('POST', '/pioneer/projects');
      const d = must(r, 'POST /pioneer/projects');
      return (d && d.id !== undefined ? d.id : r.body && r.body.id) ?? null;
    }

    case 'update': {
      must(await call('PATCH', '/pioneer/projects/' + id, payload), 'PATCH /pioneer/projects/' + id);
      return true;
    }

    case 'milestones':
      return listMilestones(id);

    case 'setMilestones': {
      const existing = await listMilestones(id);
      for (let i = 0; i < payload.length; i++) {
        const m = payload[i];
        const body = { title: m.title, description: m.description, duration: m.duration, acceptance_criteria: m.criteria };
        const found = existing.find((e) => e.phase === i + 1);
        if (found && found.id) {
          must(await call('PATCH', '/pioneer/projects/milestones/' + found.id, body), 'PATCH milestone ' + found.id);
        } else {
          must(await call('POST', '/pioneer/projects/' + id + '/milestones', body), 'POST milestone phase ' + (i + 1));
        }
      }
      return listMilestones(id);
    }

    case 'faqs': {
      const r = await call('GET', '/projects/' + id + '/faqs');
      return r.ok ? unwrap(r) || [] : [];
    }

    case 'delete': {
      const before = await call('GET', '/pioneer/projects/' + id);
      const state = before.ok ? (unwrap(before) || {}).state : null;
      if (state === 'pending_review') {
        // ถอนคำขอ -> กลับเป็นแบบร่าง (โปรเจกต์ลบได้เฉพาะสถานะ DRAFT)
        await call('PATCH', '/pioneer/projects/' + id + '/cancel');
      }

      const faqs = await call('GET', '/projects/' + id + '/faqs');
      const faqList = faqs.ok ? unwrap(faqs) || [] : [];
      await Promise.all(faqList.filter((f) => f && f.id).map((f) => call('DELETE', '/pioneer/projects/faqs/' + f.id)));

      const milestones = await listMilestones(id);
      await Promise.all(milestones.filter((m) => m.id).map((m) => call('DELETE', '/pioneer/projects/milestones/' + m.id)));

      const pr = await call('GET', '/pioneer/projects/' + id);
      const data = pr.ok ? unwrap(pr) || {} : {};
      await Promise.all([
        ...(data.stories || []).filter((s) => s.id).map((s) => call('DELETE', '/pioneer/projects/stories/' + s.id)),
        ...(data.media || []).filter((m) => m.id).map((m) => call('DELETE', '/pioneer/projects/media/' + m.id)),
      ]);

      const del = await call('DELETE', '/pioneer/projects/' + id);
      return { id, status: del.status, ok: del.ok, stateBefore: state };
    }

    default:
      throw new Error('Unknown action: ' + action);
  }
}
