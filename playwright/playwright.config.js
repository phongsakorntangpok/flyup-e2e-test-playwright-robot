// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

// โหลดค่าจาก .env ที่ root ของโปรเจกต์ (ใช้ร่วมกับ robot/)
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

module.exports = defineConfig({
  testDir: './tests',
  // ทุกเทสต์ใช้บัญชี Pioneer เดียวกันและนับจำนวนแบบร่าง จึงต้องรันทีละเทสต์
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: (process.env.BASE_URL || 'https://www.fly-up.app').replace(/\/$/, ''),
    headless: (process.env.HEADLESS || 'true').toLowerCase() !== 'false',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
