# Genewell - Wellness AI Platform

## Overview
Genewell is a personalized wellness blueprint platform built with React (frontend) and Express (backend) using Vite as the build tool. Users take a wellness quiz and receive personalized health recommendations based on their metabolism, lifestyle, and optional DNA data.

## Project Architecture
- **Frontend**: React 18 with TypeScript, Tailwind CSS, Radix UI components, React Router
- **Backend**: Express.js integrated as Vite middleware in development
- **Database**: PostgreSQL (Replit built-in, accessed via `DATABASE_URL`)
- **AI Integration**: OpenAI via Replit AI Integrations (gpt-5-mini for narrative generation)
- **Build Tool**: Vite 6
- **Language**: TypeScript
- **PDF Generation**: Client-side jsPDF with server-side AI narrative + meal plan generation
- **Payment**: Instamojo payment gateway (API + direct link methods)

## Project Structure
```
/client          - React frontend (pages, components, hooks, lib)
/server          - Express backend (routes, lib)
/shared          - Shared types/schemas (Zod)
/public          - Static assets (favicon, robots.txt, sitemap.xml, og-image.png)
vite.config.ts   - Vite dev config (port 5000, Express middleware)
vite.config.server.ts - Server build config
index.html       - SPA entry point (SEO meta tags, structured data)
```

## Key Configuration
- Dev server: port 5000, host 0.0.0.0, allowedHosts: true
- Production: `npm run build` then `npm run start` (serves on port 5000)
- Database auto-initializes tables on startup via `server/lib/db.ts`
- APP_URL env var set to `https://genewell.replit.app` for production redirects

## Product Pricing (Current)
- **Starter Blueprint**: Free (8 pages)
- **Essential Blueprint**: ₹499 (was ₹999, 50% off launch) - 14 pages
- **Premium Blueprint**: ₹999 (was ₹2,499, Best Value) - 22 pages
- **Coaching Edition**: ₹2,999 (was ₹9,999, 70% off launch) - 30 pages

## Admin System
- **Login**: Username/password auth (default: genewell / Jackyu@62, changeable in Settings)
- **Dashboard Tabs**: Overview, Users, Quiz Data, Purchases, Downloads, Traffic, Products, Settings
- **Users Tab**: Shows name, email, phone, age, gender, location + quiz count, purchase count, download count, total spend
- **Downloads Tab**: Shows email, name, phone, age, location, product, plan tier, email sent status
- **Traffic Tab**: Visitor logs with IP, country, region, city, ISP, page, bot detection (is_bot flag), user agent
- **Products Tab**: CRUD management for products (add, edit, visibility toggle, pricing, badge, popular flag)
- **Data Capture**: Quiz submissions store name, email, phone, age, gender, location
- **Bot Detection**: Automatic detection of bot traffic (Googlebot, Bingbot, crawlers, etc.) with bot visit counts
- **Excel Export**: All data exportable as .xlsx files (users, quiz, purchases, downloads, traffic)
- **Email Service**: Gmail SMTP (optional, requires GMAIL_USER and GMAIL_APP_PASSWORD)
- **Routes**: `/api/admin/*` (admin endpoints), `/api/admin/products` (product CRUD), `/api/quiz/capture` (quiz data capture), `/api/track-visit` (visitor tracking)
- **Files**: `server/routes/admin.ts`, `server/routes/quiz-capture.ts`, `server/routes/visitor-tracking.ts`, `server/lib/email-service.ts`, `client/pages/AdminDashboard.tsx`

## SEO
- **Meta Tags**: Title, description, keywords, robots, theme-color in index.html
- **Open Graph**: Type, URL, title, description, image, site_name, locale
- **Twitter Cards**: summary_large_image with title, description, image
- **Structured Data**: JSON-LD for HealthAndBeautyBusiness with offers, FAQPage schema
- **Sitemap**: public/sitemap.xml with all public pages
- **Robots.txt**: public/robots.txt with crawl directives, sitemap reference
- **OG Image**: public/og-image.png for social sharing

## PDF Tiers (Unique Content Per Tier)
- **Free**: Cover + Top 3 Actions + Wellness Baseline + Sleep Protocol + Stress Management + Progress Tracking + Action Plan
- **Essential**: Free + Metabolic Profile + Nutrition Strategy + Movement & Training Program
- **Premium**: Essential + 7-Day Meal Plan + Grocery List + Digestive Health + Skin Health + Supplements + Lab Tests
- **Coaching**: Premium + Habit Formation + Mindset Framework + Weekly Coaching Worksheet

## Database Tables
- `users` - User profiles with name, email, phone, age, gender, location
- `quiz_submissions` - Every quiz attempt with full user data and quiz answers
- `downloads` - Product download tracking with email delivery status
- `admin_credentials` - Admin login credentials (hashed passwords)
- `visitor_tracking` - Website visitor logs with IP, geolocation, ISP, user agent, pages visited
- `managed_products` - Admin-managed product catalog (name, price, visibility, badges, sort order)
- `quiz_responses`, `orders`, `pdf_records` - Original app tables

## Scripts
- `npm run dev` - Development server with HMR
- `npm run build` - Build client and server for production
- `npm run start` - Run production server

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `APP_URL` - Production app URL (set to https://genewell.replit.app in production)
- `INSTAMOJO_AUTH_KEY` / `INSTAMOJO_AUTH_TOKEN` - Payment gateway (optional)
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` - Email service for download links (optional)

## 3-Layer Architecture (PDF System v3)
- **Flow**: QuizInput → Layer 1 (validate) → Layer 2 (compute) → Generate (rules + narratives + meals) → Layer 3 (validate+loop) → PDFDataBundle → generatePDFFromBundle()
- **Layer 1 — Input Schema**: `shared/input-schema.ts` — Zod-validated QuizInputSchema with gender enum (male/female/other), required fields (name, age, height, weight, scores 0-100), type coercion and rejection of invalid types
- **Layer 2 — Central Computation**: `shared/computed-profile.ts` — Single source of truth for BMI, BMR (Mifflin-St Jeor), TDEE, calorieTarget (goal/BMI-adjusted), protein/carb/fat grams. Zero duplicate calculations. All modules reference ComputedProfile.
- **Layer 3 — Validation Controller**: `server/lib/validation-controller.ts` — 7 checks: gender-condition, macro accuracy (±3% cal, ±5g protein), narrative-score consistency, activity-training alignment, food-intolerance, supplement dedup, placeholder cleanup. If any check fails, auto-corrects and loops (max 3 iterations) until validation_status = PASS.
- **LLM Constraint**: Narrative generator prompt explicitly forbids the LLM from performing calculations. It must only rewrite summaries using pre-computed data from Layer 2.
- **Score Utils**: `shared/score-utils.ts` — Centralized scoring: high>=70, moderate 40-69, low<40.
- **Rule Engine**: `server/lib/rule-engine.ts` — Maps user scores/conditions to active modules, risk flags, lab priorities, narrative hints.
- **Narrative Generator**: `server/lib/narrative-generator.ts` — GPT-5-mini generates narratives using pre-computed data only, never calculates.
- **Meal Generator**: `server/lib/meal-generator.ts` — 90-food Indian database, macro-driven calorie-scaled portions, auto-scaling at ±5% deviation.
- **Auto-Correction**: `shared/pdf-validation.ts` — Client-side auto-correction layer (gender, food intolerance, macro scaling, placeholders, supplements).
- **PDF Renderer**: `client/lib/client-pdf-generator.ts` — PDFContext pattern, 19+ section renderers, "Automatic Adjustments Made" section in PDF.
- **Shared Types**: `shared/wellness-types.ts` — WellnessUserProfile, RuleEngineOutput, NarrativeOutput, MealPlanOutput, PDFDataBundle (with adjustments field)
- **API Routes**: `server/routes/narrative.ts` — POST /api/generate-pdf-data (3-layer pipeline), /api/generate-narratives, /api/generate-meal-plan
- **Fallback**: If AI API fails, falls back to template-based narratives (old system)
- **Backward Compatible**: Old generatePersonalizedPDFClient() still works via convertLegacyToBundle()

## Recent Changes
- 2026-02-19: 3-Layer Architecture refactor (v3)
  - Layer 1: Strict input schema (shared/input-schema.ts) with Zod validation, gender enum, required fields, type rejection
  - Layer 2: Central computation (shared/computed-profile.ts) — single BMI/BMR/TDEE/macro calculation, zero duplicate math
  - Layer 3: Validation controller (server/lib/validation-controller.ts) — 7 checks with auto-correction loop (max 3 iterations)
  - Server route refactored to 3-layer pipeline: validate → compute → generate → validate+loop → respond
  - LLM prompt updated: explicitly forbidden from performing calculations, only rewrites summaries
  - Meal generator: auto-scaling at ±5% deviation for macro compliance
  - Client-side PDF: auto-correction replaces hard-fail validation, "Automatic Adjustments Made" section in PDF
  - New files: shared/input-schema.ts, shared/computed-profile.ts, server/lib/validation-controller.ts
- 2026-02-19: Data-driven narrative engine refactor
  - Refactored monolithic 1568-line PDF generator into modular data-driven system
  - Added OpenAI integration (Replit AI Integrations, gpt-5-mini) for personalized narrative generation
  - Created rule engine: conditional modules based on sleep/stress/BMI/conditions scores
  - Built 90-food Indian database with calorie-scaled meal generator (seeded PRNG for reproducibility)
  - Server-side endpoints: /api/generate-pdf-data combines rule engine + AI narratives + meal plan
  - Modular PDF renderer with 19 standalone section functions and dynamic composition
  - Download page now calls server API first (AI narratives), falls back to templates if unavailable
  - New files: shared/wellness-types.ts, server/lib/rule-engine.ts, server/lib/narrative-generator.ts, server/lib/meal-generator.ts, server/routes/narrative.ts
- 2026-02-19: Premium Add-Ons fix, Lab Tests, Hindi language, PDF optimization
  - Fixed Premium Add-Ons: Corrected add-on ID mismatch (was checking wrong IDs, content never appeared)
  - Added full 3-page content for all 6 add-ons: DNA & Genetics, Advanced Supplement, Athletic Performance, Family Wellness, Women's Hormonal Health, Men's Performance
  - Recommended Pathology Lab Tests: Now available for ALL tiers (was premium-only), personalized based on user's scores, BMI, medical conditions, diet
  - Added Indian lab pricing and testing schedule recommendations
  - Hindi language support: Language toggle (Globe icon) on Home and Pricing pages, bilingual PDF intro
  - PDF spacing optimization: Tightened text/bullet spacing to reduce blank pages
  - New files: client/lib/translations.ts, client/components/LanguageToggle.tsx
- 2026-02-16: Admin dashboard fixes, product display & SEO optimization
  - Fixed Downloads tab: plan-tier colored badges instead of "Client-side PDF", added Send Email button
  - Added Downloads count column to Purchases tab
  - Auto-seed managed_products table with 4 default products on server startup
  - Added resend-email endpoint: POST /api/admin/resend-download-email
  - Product display: 4-column responsive grid on homepage, proper mobile layout on pricing page
  - Removed scale-105 on popular cards (broke mobile), replaced with subtle lg:scale-[1.02]
  - Added Tailwind safelist for dynamic color classes (prevents CSS purge in production)
  - Enhanced SEO: WebApplication schema, geo meta tags, OG image dimensions, preconnect hints
  - Enhanced meta robots with max-image-preview, max-snippet directives
- 2026-02-16: Major admin dashboard & SEO enhancements
  - Refined products with trend-based pricing: Essential ₹499 (was ₹999), Premium ₹999 (was ₹2,499), Coaching ₹2,999 (was ₹9,999)
  - Added originalPrice, badge, popular fields to products for strikethrough pricing display
  - Admin Users tab: now shows quiz count, purchase count, download count, total spend per user
  - Admin Downloads tab: now shows phone, age, location from user profiles
  - Admin Traffic tab: bot detection with is_bot flag, bot visit count, user agent display
  - Admin Products tab: full CRUD for product management (managed_products DB table)
  - Comprehensive SEO: meta tags, Open Graph, Twitter Cards, JSON-LD structured data
  - Added sitemap.xml, enhanced robots.txt with sitemap reference
  - Generated OG image for social sharing
  - Updated all hardcoded prices across QuizResults and Pricing pages
- 2026-02-15: Production readiness improvements
  - Enhanced PDF generator with research-based content, unique per tier, personalized to quiz answers
  - Added digestive health, skin health, habit formation, mindset sections to PDF
  - Fixed Instamojo payment flow: shortened purpose, correct redirect URLs, post-payment emails
  - Improved PaymentSuccess page to handle direct payments and API-verified payments
  - Quiz UX: question counter in header, simplified trust indicators
  - Admin dashboard: download links updated to reflect client-side PDF generation
  - Removed placeholder pages (demo, reports, premium, help, privacy, terms, contact) — redirected to real pages
  - Removed calendly.com fake link, updated copyright years to 2026
  - Set APP_URL environment variable for production
- 2026-02-13: Data export and PDF linking improvements
  - Replaced custom XML Excel generation with ExcelJS library for reliable .xlsx files
  - Enhanced download tracking to capture client-side PDF generation events
  - Updated traffic export to include full geolocation data
- 2026-02-12: Admin backend system implementation
  - Session-based admin auth with username/password login
  - Quiz data capture with phone number and location fields
  - Download tracking and email delivery system
  - Excel export for users, quiz, purchases, and downloads
  - Admin dashboard UI with tabs
- 2026-02-12: Initial import and Replit environment setup
