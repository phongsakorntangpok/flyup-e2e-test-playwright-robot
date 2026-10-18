*** Settings ***
Documentation     Keywords สำหรับเทสต์ FlyUp (Pioneer) — logic เดียวกับ playwright/tests/support/flyup.js
Library           Browser    timeout=20s    auto_closing_level=KEEP
Library           Collections
Library           TestFiles.py
Variables         ../variables.py


*** Variables ***
# selectors (ตรงกับ SEL ใน playwright/tests/support/flyup.js)
${SEL_TITLE}                  css=[data-testid="basics-title-input"]
${SEL_DESCRIPTION}            css=[data-testid="basics-description-input"]
${SEL_CATEGORY_DROPDOWN}      css=[data-testid="basics-category-dropdown-btn"]
${SEL_CATEGORY_FIRST}         css=[data-testid^="basics-category-option-"] >> nth=0
${SEL_FUNDING_GOAL}           css=[data-testid="basics-funding-goal-input"]
${SEL_PROJECT_DURATION}       css=[data-testid="basics-project-duration-input"]
${SEL_SOFT_CAP}               css=[data-testid="basics-soft-cap-input"]
${SEL_CAMPAIGN_DURATION}      css=[data-testid="basics-campaign-duration-input"]
${SEL_REVENUE_SHARE}          css=[data-testid="basics-revenue-share-input"]
${SEL_MIN_INVEST}             css=label:text-is("ลงทุนขั้นต่ำ (บาท)") + input
${SEL_COVER_INPUT}            css=[data-testid="basics-cover-image-input"]
${SEL_COVER_PREVIEW}          css=img[alt="cover"]
${SEL_COVER_DROPZONE}         css=[data-testid="basics-cover-image-dropzone"]
${SEL_IMAGES_INPUT}           css=[data-testid="basics-additional-images-input"]
${SEL_VIDEO_INPUT}            css=[data-testid="basics-video-input"]
${SEL_STORY_EDITOR}           css=.ProseMirror
${SEL_RISK}                   css=p:has-text("ความเสี่ยงของโปรเจกต์") + textarea
${SEL_FAQ_QUESTION}           css=[data-testid="faq-question-input"]
${SEL_FAQ_ADD}                css=[data-testid="faq-add-btn"]
${SEL_MS_TITLE}               css=input[maxlength="50"]
${SEL_MS_DESCRIPTION}         css=textarea[maxlength="5000"]
${SEL_MS_DURATION}            css=input[inputmode="numeric"][maxlength="3"]
${SEL_MS_CRITERIA_1}          css=div:has(> span:text-is("1.")) > input
${SEL_AGREE_CHECKBOX}         css=input[type="checkbox"]
${SEL_STEP4_CONFIRM}          css=[data-testid="step4-submit-btn"]
${SEL_CREATE_BUTTON}          css=button:has-text("${TEXT}[createButton]")
${SEL_SUBMIT_BUTTON}          css=button:has-text("${TEXT}[submitButton]")
${SEL_NEXT_LINK}              css=a:has-text("${TEXT}[nextButton]")
${SEL_DRAFT_STAT_COUNT}       css=button:has(> span:text-is("${TEXT}[draftLabel]")) >> span >> nth=0


*** Keywords ***
# ───────────── Setup / Teardown ─────────────
Open FlyUp And Login As Pioneer
    [Documentation]    เปิด browser, ปิด Cookie banner, เข้าสู่ระบบ Pioneer และเก็บ snapshot โปรเจกต์ก่อนเริ่มเทสต์
    Should Not Be Empty    ${PIONEER_EMAIL}       msg=กรุณาตั้งค่า PIONEER_EMAIL ในไฟล์ .env
    Should Not Be Empty    ${PIONEER_PASSWORD}    msg=กรุณาตั้งค่า PIONEER_PASSWORD ในไฟล์ .env
    New Browser    chromium    headless=${HEADLESS}
    New Context    locale=th-TH    timezoneId=Asia/Bangkok    viewport={'width': 1280, 'height': 800}
    New Page    ${BASE_URL}/login
    LocalStorage Set Item    flyup_cookie_consent    {"status":"declined","version":"1"}
    Reload
    Fill Text      css=[data-testid="login-email"]       ${PIONEER_EMAIL}
    Fill Secret    css=[data-testid="login-password"]    $PIONEER_PASSWORD
    Click          css=[data-testid="login-submit"]
    Get Url    not contains    /login    message=เข้าสู่ระบบไม่สำเร็จ (ยังอยู่หน้า /login)
    Wait Until Keyword Succeeds    15s    1s    Auth Token Should Exist
    ${api_base}=    Resolve Api Base
    Set Test Variable    ${API_BASE}    ${api_base}
    ${created}=    Create List
    Set Test Variable    @{CREATED_IDS}    @{created}
    ${projects}=    List My Projects
    ${snapshot}=    Evaluate    [p['id'] for p in $projects]
    Set Test Variable    @{SNAPSHOT_IDS}    @{snapshot}

Auth Token Should Exist
    ${token}=    LocalStorage Get Item    auth_token
    Should Not Be Empty    ${token}

Resolve Api Base
    IF    $API_BASE_URL    RETURN    ${API_BASE_URL}
    ${base}=    Wait Until Keyword Succeeds    15s    1s    Detect Api Base From Page
    RETURN    ${base}

Detect Api Base From Page
    ${base}=    FlyUp Api    detectApiBase
    Should Not Be Equal    ${base}    ${None}    msg=หา API base URL ไม่เจอ — ตั้ง API_BASE_URL ใน .env
    RETURN    ${base}

Cleanup Projects Created During Test
    [Documentation]    Post-condition: ลบโปรเจกต์ที่เทสต์สร้าง (id ที่บันทึกไว้ + แบบร่าง/รอตรวจสอบใหม่ที่ไม่อยู่ใน snapshot)
    ${has_api}=    Get Variable Value    ${API_BASE}    ${None}
    ${has_snapshot}=    Get Variable Value    ${SNAPSHOT_IDS}    ${None}
    IF    $has_api is None or $has_snapshot is None    RETURN    # login/setup ไม่สำเร็จ = ยังไม่ได้สร้างอะไร
    ${projects}=    List My Projects
    ${targets}=    Evaluate    list(dict.fromkeys(list($CREATED_IDS) + [p['id'] for p in $projects if p['state'] in ('draft', 'pending_review') and p['id'] not in $SNAPSHOT_IDS]))
    FOR    ${id}    IN    @{targets}
        ${result}=    FlyUp Api    delete    ${id}
        Log    [cleanup] DELETE project ${id} (${result}[stateBefore]) -> HTTP ${result}[status]    console=True
    END
    ${remaining}=    List My Projects
    ${not_deleted}=    Evaluate    [i for i in $targets if i in [p['id'] for p in $remaining]]
    Should Be Empty    ${not_deleted}    msg=ลบโปรเจกต์ที่เทสต์สร้างไม่สำเร็จ: ${not_deleted}

Cleanup And Close Browser
    Run Keyword And Continue On Failure    Cleanup Projects Created During Test
    Close Browser    ALL

# ───────────── API ─────────────
FlyUp Api
    [Documentation]    เรียก shared/flyup-api.js ภายในหน้าเว็บ (ใช้ token/CORS เดียวกับแอป)
    [Arguments]    ${action}    ${id}=${None}    ${payload}=${None}
    ${api_base}=    Get Variable Value    ${API_BASE}    ${None}
    ${arg}=    Evaluate    json.dumps({'action': $action, 'apiBase': $api_base, 'id': None if $id is None else int($id), 'payload': $payload}, ensure_ascii=False)    modules=json
    ${result}=    Evaluate JavaScript    ${None}    async () => (${API_JS})(${arg})
    RETURN    ${result}

List My Projects
    ${projects}=    FlyUp Api    list
    RETURN    ${projects}

Count Draft Projects
    ${projects}=    List My Projects
    ${count}=    Evaluate    len([p for p in $projects if p['state'] == 'draft'])
    RETURN    ${count}

Get Project
    [Arguments]    ${id}
    ${project}=    FlyUp Api    get    ${id}
    RETURN    ${project}

Create Draft Project Via API
    ${id}=    FlyUp Api    create
    Should Not Be Equal    ${id}    ${None}    msg=สร้างแบบร่างผ่าน API ไม่สำเร็จ
    Append To List    ${CREATED_IDS}    ${id}
    RETURN    ${id}

Draft Slot Should Be Available
    ${drafts}=    Count Draft Projects
    Should Be True    ${drafts} < ${MAX_DRAFT_PROJECTS}    msg=บัญชีมีแบบร่างครบ 5 แล้ว กรุณาลบแบบร่างเก่าก่อนรันเทสต์

No Blocking Project Should Exist
    ${projects}=    List My Projects
    ${blocking}=    Evaluate    [p for p in $projects if p['state'] in $BLOCKING_STATES]
    Should Be Empty    ${blocking}    msg=บัญชีมีโปรเจกต์ที่กำลังระดมทุน/ดำเนินการ/รอตรวจสอบอยู่ จึงส่งคำขอใหม่ไม่ได้

Prepare Draft
    [Documentation]    Pre-condition: สร้างแบบร่างผ่าน API แล้วตั้งชื่อ "AUTO <TC>" (+ ข้อมูลเพิ่มเติม / Milestone ถ้ามี)
    [Arguments]    ${tc_id}    ${update}=${None}    ${milestones}=${None}
    Draft Slot Should Be Available
    ${id}=    Create Draft Project Via API
    ${title}=    Set Variable    AUTO ${tc_id}
    ${payload}=    Evaluate    {'title': $title, **($update or {})}
    FlyUp Api    update    ${id}    ${payload}
    IF    $milestones is not None    FlyUp Api    setMilestones    ${id}    ${milestones}
    RETURN    ${id}    ${title}

Project Should Match
    [Documentation]    รอจนค่าใน backend ตรงตามที่คาด (auto-save เป็น async)
    [Arguments]    ${id}    &{expected}
    Wait Until Keyword Succeeds    15s    1s    Project Fields Should Equal    ${id}    &{expected}

Project Fields Should Equal
    [Arguments]    ${id}    &{expected}
    ${project}=    Get Project    ${id}
    FOR    ${key}    ${value}    IN    &{expected}
        Should Be Equal As Strings    ${project}[${key}]    ${value}    msg=${key}: backend=${project}[${key}] คาดว่า=${value}
    END

Milestone Phase 1 Duration Should Be
    [Arguments]    ${id}    ${expected}
    ${milestones}=    FlyUp Api    milestones    ${id}
    ${duration}=    Evaluate    next((m['duration'] for m in $milestones if m['phase'] == 1), None)
    Should Be Equal As Integers    ${duration}    ${expected}

Completed Milestones Should Be
    [Arguments]    ${id}    ${expected}
    ${milestones}=    FlyUp Api    milestones    ${id}
    ${count}=    Evaluate    len([m for m in $milestones if m['title'] and m['duration'] > 0])
    Should Be Equal As Integers    ${count}    ${expected}

Story And Risk Should Be Saved
    [Arguments]    ${id}
    ${project}=    Get Project    ${id}
    Should Contain    ${project}[story]    ${PROJECT}[story]
    Should Be Equal    ${project}[risk]    ${PROJECT}[risk]

# ───────────── UI ─────────────
Open My Projects Page
    Go To    ${BASE_URL}/pioneer/dashboard/projects
    Wait For Elements State    h1:has-text("${TEXT}[myProjectsHeading]")    visible
    Wait For Elements State    ${SEL_CREATE_BUTTON}    enabled

Open Project Page
    [Documentation]    เปิดหน้า wizard แล้วรอให้แอปโหลดข้อมูลโปรเจกต์เสร็จก่อนเริ่มกรอก
    [Arguments]    ${id}    ${step}=${None}
    ${url}=    Set Variable If    $step is None    ${BASE_URL}/project/overview/${id}    ${BASE_URL}/project/overview/${id}/step/${step}
    ${loaded}=    Promise To    Wait For Response    matcher=**/projects/${id}/milestones    timeout=30s
    Go To    ${url}
    Wait For    ${loaded}
    Sleep    0.5s

Open Step 1
    [Arguments]    ${id}    ${title}
    Open Project Page    ${id}    1
    Wait Until Keyword Succeeds    15s    0.5s    Get Property    ${SEL_TITLE}    value    ==    ${title}

Fill And Blur
    [Documentation]    คลิก (focus) → พิมพ์ค่า → กด Tab (blur) เพื่อให้แอป auto-save
    [Arguments]    ${selector}    ${value}
    Click    ${selector}
    Fill Text    ${selector}    ${value}
    Press Keys    ${selector}    Tab

Input Value Should Be
    [Arguments]    ${selector}    ${expected}
    ${expected}=    Convert To String    ${expected}
    Get Property    ${selector}    value    ==    ${expected}

Toast Should Be Visible
    [Arguments]    ${text}    ${timeout}=15s
    Wait For Elements State    css=[role="status"]:has-text("${text}")    visible    timeout=${timeout}

Draft Stat Count Should Be
    [Arguments]    ${expected}
    ${expected}=    Convert To String    ${expected}
    Get Text    ${SEL_DRAFT_STAT_COUNT}    ==    ${expected}

Fill Step 1 Basics
    Fill And Blur    ${SEL_TITLE}                  ${PROJECT}[title]
    Fill And Blur    ${SEL_DESCRIPTION}            ${PROJECT}[description]
    Click    ${SEL_CATEGORY_DROPDOWN}
    ${category}=    Get Text    ${SEL_CATEGORY_FIRST}
    Click    ${SEL_CATEGORY_FIRST}
    Fill And Blur    ${SEL_FUNDING_GOAL}           ${PROJECT}[fundingGoal]
    Fill And Blur    ${SEL_PROJECT_DURATION}       ${PROJECT}[projectDurationMonths]
    Fill And Blur    ${SEL_CAMPAIGN_DURATION}      ${PROJECT}[campaignDays]
    Fill And Blur    ${SEL_REVENUE_SHARE}          ${PROJECT}[profitSharePct]
    RETURN    ${category.strip()}

Fill Milestone Phase
    [Arguments]    ${index}    ${milestone}
    ${phase}=    Evaluate    ${index} + 1
    IF    ${index} > 0    Click    css=button:text-is("Phase ${phase}")
    Wait For Elements State    css=h2:text-is("Milestone ${phase}")    visible
    Fill And Blur    ${SEL_MS_TITLE}          ${milestone}[title]
    Fill And Blur    ${SEL_MS_DESCRIPTION}    ${milestone}[description]
    Fill And Blur    ${SEL_MS_DURATION}       ${milestone}[duration]
    Fill And Blur    ${SEL_MS_CRITERIA_1}     ${milestone}[criteria]
