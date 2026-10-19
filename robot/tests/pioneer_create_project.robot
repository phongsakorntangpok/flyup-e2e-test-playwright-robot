*** Settings ***
Documentation     US-14 : Pioneer สร้างโปรเจกต์
...               เอกสาร: docs/user-story.md และ docs/test-scenarios-and-test-cases.md
Resource          ../resources/flyup.resource
Test Setup        Open FlyUp And Login As Pioneer
Test Teardown     Cleanup And Close Browser
Test Timeout      3 minutes


*** Test Cases ***
# ───────────── Scenario-14.1 การเข้าถึงและสร้างโปรเจกต์ฉบับร่าง ─────────────
TC-14-001 [P] สร้างโปรเจกต์แบบร่างสำเร็จ
    [Tags]    positive    TC-14-001    scenario-14.1
    Draft Slot Should Be Available
    ${drafts_before}=    Count Draft Projects
    Open My Projects Page
    Click    ${SEL_CREATE_BUTTON}
    Get Url    matches    /project/overview/\\d+$
    ${url}=    Get Url
    ${id}=    Evaluate    int(re.search(r'/project/overview/(\\d+)', $url).group(1))    modules=re
    Append To List    ${CREATED_IDS}    ${id}
    Wait For Elements State    h1:has-text("${TEXT}[overviewHeading]")    visible
    ${project}=    Get Project    ${id}
    Should Be Equal    ${project}[state]    draft
    ${drafts_after}=    Count Draft Projects
    Should Be Equal As Integers    ${drafts_after}    ${drafts_before + 1}
    Open My Projects Page
    Draft Stat Count Should Be    ${drafts_after}

TC-14-002 [N] สร้างโปรเจกต์ไม่ได้เมื่อมีแบบร่างครบ 5 โปรเจกต์
    [Tags]    negative    TC-14-002    scenario-14.1
    ${existing}=    Count Draft Projects
    FOR    ${i}    IN RANGE    ${existing}    ${MAX_DRAFT_PROJECTS}
        Create Draft Project Via API
    END
    ${drafts_before}=    Count Draft Projects
    Should Be True    ${drafts_before} >= ${MAX_DRAFT_PROJECTS}
    Open My Projects Page
    Draft Stat Count Should Be    ${drafts_before}
    Click    ${SEL_CREATE_BUTTON}
    Toast Should Be Visible    ${TEXT}[toastDraftLimit]
    Get Url    contains    /pioneer/dashboard/projects
    ${drafts_after}=    Count Draft Projects
    Should Be Equal As Integers    ${drafts_after}    ${drafts_before}

# ───────────── Scenario-14.2 กรอกข้อมูลพื้นฐานโปรเจกต์ (Step 1) ─────────────
TC-14-003 [P] กรอกข้อมูลพื้นฐานครบถ้วนและบันทึกอัตโนมัติ
    [Tags]    positive    TC-14-003    scenario-14.2
    ${id}    ${title}=    Prepare Draft    TC-14-003
    Open Step 1    ${id}    ${title}
    ${category}=    Fill Step 1 Basics
    Input Value Should Be    ${SEL_SOFT_CAP}      ${PROJECT}[expectedSoftCapText]
    Input Value Should Be    ${SEL_MIN_INVEST}    ${PROJECT}[expectedMinInvestText]
    Project Should Match    ${id}
    ...    state=draft
    ...    title=${PROJECT}[title]
    ...    description=${PROJECT}[description]
    ...    category=${category}
    ...    fundingGoal=${PROJECT}[fundingGoal]
    ...    softCap=${PROJECT}[expectedSoftCap]
    ...    durationMonths=${PROJECT}[projectDurationMonths]
    ...    campaignDays=${PROJECT}[campaignDays]
    ...    profitSharePct=${PROJECT}[profitSharePct]

TC-14-004 [N] เป้าหมายเงินทุนต่ำกว่า 1,000 บาท
    [Tags]    negative    TC-14-004    scenario-14.2
    ${id}    ${title}=    Prepare Draft    TC-14-004
    Open Step 1    ${id}    ${title}
    Fill And Blur    ${SEL_FUNDING_GOAL}    ${INVALID}[fundingGoalBelowMin]
    Toast Should Be Visible    ${TEXT}[toastFundingGoalMin]
    Input Value Should Be    ${SEL_FUNDING_GOAL}    ${INVALID}[fundingGoalMinText]
    Project Should Match    ${id}    fundingGoal=${INVALID}[fundingGoalMin]

TC-14-005 [N] Soft Cap ต่ำกว่า 70% ของเป้าหมายเงินทุน
    [Tags]    negative    TC-14-005    scenario-14.2
    ${id}    ${title}=    Prepare Draft    TC-14-005
    Open Step 1    ${id}    ${title}
    Fill And Blur    ${SEL_FUNDING_GOAL}    ${PROJECT}[fundingGoal]
    Fill And Blur    ${SEL_SOFT_CAP}        ${INVALID}[softCapBelow70]
    Toast Should Be Visible    ${TEXT}[toastSoftCapMin]
    Input Value Should Be    ${SEL_SOFT_CAP}    ${PROJECT}[expectedSoftCapText]
    Project Should Match    ${id}    softCap=${PROJECT}[expectedSoftCap]

TC-14-006 [N] ระยะเวลาระดมทุนเกิน 60 วัน
    [Tags]    negative    TC-14-006    scenario-14.2
    ${id}    ${title}=    Prepare Draft    TC-14-006
    Open Step 1    ${id}    ${title}
    Fill And Blur    ${SEL_CAMPAIGN_DURATION}    ${INVALID}[campaignDaysOver]
    Toast Should Be Visible    ${TEXT}[toastCampaignRange]
    Input Value Should Be    ${SEL_CAMPAIGN_DURATION}    ${INVALID}[campaignDaysMax]
    Project Should Match    ${id}    campaignDays=${INVALID}[campaignDaysMax]

TC-14-007 [N] ส่วนแบ่งกำไรเกิน 50%
    [Tags]    negative    TC-14-007    scenario-14.2
    ${id}    ${title}=    Prepare Draft    TC-14-007
    Open Step 1    ${id}    ${title}
    Fill And Blur    ${SEL_REVENUE_SHARE}    ${INVALID}[profitSharePctOver]
    Toast Should Be Visible    ${TEXT}[toastProfitShareMax]
    Input Value Should Be    ${SEL_REVENUE_SHARE}    ${INVALID}[profitSharePctMax]
    Project Should Match    ${id}    profitSharePct=${INVALID}[profitSharePctMax]

# ───────────── Scenario-14.3 อัปโหลดสื่อประกอบ (Step 1) ─────────────
TC-14-008 [N] รูปภาพปกขนาดเกิน 5MB
    [Tags]    negative    TC-14-008    scenario-14.3
    ${id}    ${title}=    Prepare Draft    TC-14-008
    Open Step 1    ${id}    ${title}
    ${file}=    Create Large File    large-${INVALID}[coverTooLargeMB]mb.png    ${INVALID}[coverTooLargeMB]
    Upload File By Selector    ${SEL_COVER_INPUT}    ${file}
    Toast Should Be Visible    ${TEXT}[toastImageTooLarge]
    Wait For Elements State    ${SEL_COVER_DROPZONE}    visible
    Get Element Count    ${SEL_COVER_PREVIEW}    ==    0
    Project Should Match    ${id}    coverImage=${EMPTY}

TC-14-009 [N] รูปภาพปกนามสกุลไม่รองรับ
    [Tags]    negative    TC-14-009    scenario-14.3
    ${id}    ${title}=    Prepare Draft    TC-14-009
    Open Step 1    ${id}    ${title}
    ${file}=    Create Gif File
    Upload File By Selector    ${SEL_COVER_INPUT}    ${file}
    Toast Should Be Visible    ${TEXT}[toastImageType]
    Wait For Elements State    ${SEL_COVER_DROPZONE}    visible
    Get Element Count    ${SEL_COVER_PREVIEW}    ==    0
    Project Should Match    ${id}    coverImage=${EMPTY}

TC-14-010 [N] วิดีโอขนาดเกิน 10MB
    [Tags]    negative    TC-14-010    scenario-14.3
    ${id}    ${title}=    Prepare Draft    TC-14-010
    Open Step 1    ${id}    ${title}
    ${file}=    Create Large File    large-${INVALID}[videoTooLargeMB]mb.mp4    ${INVALID}[videoTooLargeMB]
    Upload File By Selector    ${SEL_VIDEO_INPUT}    ${file}
    Toast Should Be Visible    ${TEXT}[toastVideoTooLarge]
    Wait For Elements State    text="${TEXT}[videoCounterEmpty]"    visible
    Project Should Match    ${id}    videoCount=0

# ───────────── Scenario-14.4 เรื่องราวและคำถามที่พบบ่อย (Step 2) ─────────────
TC-14-011 [N] เพิ่ม FAQ โดยไม่กรอกคำตอบ
    [Tags]    negative    TC-14-011    scenario-14.4
    ${id}    ${title}=    Prepare Draft    TC-14-011
    Open Project Page    ${id}    2
    Fill Text    ${SEL_FAQ_QUESTION}    ${FAQ}[question]
    Click    ${SEL_FAQ_ADD}
    Toast Should Be Visible    ${TEXT}[toastFaqRequired]
    Input Value Should Be    ${SEL_FAQ_QUESTION}    ${FAQ}[question]
    ${faqs}=    FlyUp Api    faqs    ${id}
    Length Should Be    ${faqs}    0

# ───────────── Scenario-14.5 กำหนด Milestone (Step 3) ─────────────
TC-14-012 [N] ระยะเวลา Milestone รวมเกินระยะเวลาโปรเจกต์
    [Tags]    negative    TC-14-012    scenario-14.5
    ${update}=    Create Dictionary    duration_months=${INVALID}[milestoneProjectDurationMonths]
    ${id}    ${title}=    Prepare Draft    TC-14-012    update=${update}
    Open Project Page    ${id}    3
    Fill And Blur    ${SEL_MS_DURATION}    ${INVALID}[milestoneDurationOver]
    Toast Should Be Visible    ${TEXT}[toastMilestoneClamp]
    Input Value Should Be    ${SEL_MS_DURATION}    ${INVALID}[milestoneDurationClamped]
    Wait Until Keyword Succeeds    15s    1s    Milestone Phase 1 Duration Should Be    ${id}    ${INVALID}[milestoneDurationClamped]

# ───────────── Scenario-14.6 ยืนยันและส่งคำขอสร้างโปรเจกต์ (Step 4) ─────────────
TC-14-013 [N] ไม่ติ๊กยอมรับข้อตกลง ปุ่มส่งคำขอกดไม่ได้
    [Tags]    negative    TC-14-013    scenario-14.6
    No Blocking Project Should Exist
    ${update}=    Create Dictionary    duration_months=${PROJECT}[projectDurationMonths]
    ${id}    ${title}=    Prepare Draft    TC-14-013    update=${update}    milestones=${MILESTONES}
    Open Project Page    ${id}    4
    Get Checkbox State    ${SEL_AGREE_CHECKBOX}    ==    unchecked
    Wait For Elements State    ${SEL_SUBMIT_BUTTON}    disabled
    # ยืนยันว่าสาเหตุคือการไม่ยอมรับข้อตกลง: ติ๊กแล้วปุ่มต้องกดได้
    Check Checkbox    ${SEL_AGREE_CHECKBOX}
    Wait For Elements State    ${SEL_SUBMIT_BUTTON}    enabled
    Project Should Match    ${id}    state=draft

TC-14-014 [N] ข้อมูลไม่ครบถ้วน ปุ่มส่งคำขอในหน้าภาพรวมกดไม่ได้
    [Tags]    negative    TC-14-014    scenario-14.6
    ${id}    ${title}=    Prepare Draft    TC-14-014
    Open Project Page    ${id}
    Wait For Elements State    h1:has-text("${TEXT}[overviewHeading]")    visible
    Wait For Elements State    ${SEL_SUBMIT_BUTTON}    disabled
    Project Should Match    ${id}    state=draft

TC-14-015 [P] สร้างและส่งคำขอสร้างโปรเจกต์สำเร็จ (ครบทุกขั้นตอน)
    [Tags]    positive    TC-14-015    scenario-14.6
    [Timeout]    5 minutes
    Draft Slot Should Be Available
    No Blocking Project Should Exist
    # 1. สร้างโปรเจกต์ใหม่จากหน้า "โปรเจกต์ของฉัน"
    Open My Projects Page
    Click    ${SEL_CREATE_BUTTON}
    Get Url    matches    /project/overview/\\d+$
    ${url}=    Get Url
    ${id}=    Evaluate    int(re.search(r'/project/overview/(\\d+)', $url).group(1))    modules=re
    Append To List    ${CREATED_IDS}    ${id}
    # 2. Step 1: กรอกข้อมูลพื้นฐานและอัปโหลดรูปปก + รูปประกอบ
    Open Project Page    ${id}    1
    Fill Step 1 Basics
    ${cover}=    Create Valid Png    cover.png
    Upload File By Selector    ${SEL_COVER_INPUT}    ${cover}
    Toast Should Be Visible    ${TEXT}[toastCoverUploaded]    timeout=60s
    Wait For Elements State    ${SEL_COVER_PREVIEW}    visible
    ${image}=    Create Valid Png    image-1.png
    Upload File By Selector    ${SEL_IMAGES_INPUT}    ${image}
    Toast Should Be Visible    ${TEXT}[toastImagesUploaded]    timeout=60s
    Wait For Elements State    text="1/5 รูป"    visible
    Project Should Match    ${id}    title=${PROJECT}[title]    fundingGoal=${PROJECT}[fundingGoal]    imageCount=1
    Click    ${SEL_NEXT_LINK}
    Get Url    matches    /project/overview/${id}/step/2$
    # 3. Step 2: กรอกเรื่องราวและความเสี่ยง
    Click    ${SEL_STORY_EDITOR}
    Keyboard Input    type    ${PROJECT}[story]
    Fill And Blur    ${SEL_RISK}    ${PROJECT}[risk]
    Wait Until Keyword Succeeds    15s    1s    Story And Risk Should Be Saved    ${id}
    Click    ${SEL_NEXT_LINK}
    Get Url    matches    /project/overview/${id}/step/3$
    # 4. Step 3: กรอก Milestone ครบ 4 Phase
    FOR    ${index}    ${milestone}    IN ENUMERATE    @{MILESTONES}
        Fill Milestone Phase    ${id}    ${index}    ${milestone}
    END
    Milestones Should Be Saved    ${id}    ทั้ง 4 Phase    ${MILESTONES}
    Click    ${SEL_NEXT_LINK}
    Get Url    matches    /project/overview/${id}/step/4$
    # 5. Step 4: ยอมรับข้อตกลงและส่งคำขอ
    Check Checkbox    ${SEL_AGREE_CHECKBOX}
    Wait For Elements State    ${SEL_SUBMIT_BUTTON}    enabled
    Click    ${SEL_SUBMIT_BUTTON}
    Click    ${SEL_STEP4_CONFIRM}
    # 6. ระบบเปลี่ยนสถานะเป็น "รอการตรวจสอบ" และพากลับหน้าโปรเจกต์ของฉัน
    Wait Until Keyword Succeeds    30s    1s    Get Url    matches    /pioneer/dashboard/projects$
    Project Should Match    ${id}    state=pending_review
    Get Text    css=h3:text-is("${PROJECT}[title]") + span >> nth=0    ==    ${TEXT}[pendingReviewLabel]
