import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'**/*.spec.ts',timeout:60000,fullyParallel:false,workers:1,use:{channel:'chrome',baseURL:process.env.BASE_URL||'http://localhost:3111',headless:true,screenshot:'only-on-failure',trace:'off'},reporter:'list'});
