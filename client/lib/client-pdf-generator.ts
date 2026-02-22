import jsPDF from "jspdf";
import type {
  PDFDataBundle,
  WellnessUserProfile,
  RuleEngineOutput,
  NarrativeOutput,
  MealPlanOutput,
  DayMeal,
  MealItem,
  PrioritizedLabTest,
} from "../../shared/wellness-types";
import { validatePDFBundle } from "../../shared/pdf-validation";

// ══════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE INTERFACES (legacy exports)
// ══════════════════════════════════════════════════════════════

export interface PersonalizationProfile {
  name: string;
  email: string;
  age: number;
  gender: string;
  estimatedHeightCm: number;
  estimatedWeightKg: number;
  estimatedBMR: number;
  estimatedTDEE: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  stressScore: number;
  sleepScore: number;
  activityScore: number;
  energyScore: number;
  medicalConditions: string[];
  digestiveIssues: string[];
  foodIntolerances: string[];
  skinConcerns: string[];
  dietaryPreference: string;
  exercisePreference: string[];
  workSchedule: string;
  region: string;
  recommendedTests: string[];
  supplementPriority: string[];
  exerciseIntensity: string;
  mealFrequency: number;
  dnaConsent: boolean;
}

export interface PersonalizationInsights {
  metabolicInsight: string;
  recommendedMealTimes: string[];
  calorieRange: { min: number; max: number };
  macroRatios: { protein: number; carbs: number; fats: number };
  supplementStack: Array<{ name: string; reason: string; dosage: string }>;
  workoutStrategy: string;
  sleepStrategy: string;
  stressStrategy: string;
}

export interface PersonalizationData {
  profile: PersonalizationProfile;
  insights: PersonalizationInsights;
}

export interface PDFGenerationOptions {
  tier: "free" | "essential" | "premium" | "coaching";
  addOns?: string[];
  orderId: string;
  timestamp: string;
  language?: "en" | "hi";
}

// ══════════════════════════════════════════════════════════════
// PDF CONTEXT & LAYOUT UTILITIES
// ══════════════════════════════════════════════════════════════

interface PDFContext {
  pdf: jsPDF;
  yPosition: number;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
}

function addNewPage(ctx: PDFContext): void {
  ctx.pdf.addPage();
  ctx.yPosition = ctx.margin;
}

function checkPageBreak(ctx: PDFContext, spaceNeeded: number): void {
  if (ctx.yPosition + spaceNeeded > ctx.pageHeight - ctx.margin) addNewPage(ctx);
}

function addHeaderSection(ctx: PDFContext, title: string, subtitle?: string): void {
  checkPageBreak(ctx, 18);
  ctx.pdf.setFontSize(18);
  ctx.pdf.setTextColor(45, 55, 72);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.text(title, ctx.margin, ctx.yPosition);
  ctx.yPosition += 8;
  if (subtitle) {
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(113, 128, 150);
    ctx.pdf.setFont("helvetica", "normal");
    const lines = ctx.pdf.splitTextToSize(subtitle, ctx.contentWidth);
    ctx.pdf.text(lines, ctx.margin, ctx.yPosition);
    ctx.yPosition += lines.length * 4 + 2;
  }
  ctx.pdf.setDrawColor(229, 231, 235);
  ctx.pdf.line(ctx.margin, ctx.yPosition, ctx.pageWidth - ctx.margin, ctx.yPosition);
  ctx.yPosition += 3;
}

function addSubSection(ctx: PDFContext, title: string): void {
  checkPageBreak(ctx, 10);
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(74, 85, 104);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.text(title, ctx.margin, ctx.yPosition);
  ctx.yPosition += 7;
}

function addText(ctx: PDFContext, text: string, size = 10, color: [number, number, number] = [17, 24, 39], isBold = false): void {
  checkPageBreak(ctx, 6);
  ctx.pdf.setFontSize(size);
  ctx.pdf.setTextColor(...color);
  ctx.pdf.setFont("helvetica", isBold ? "bold" : "normal");
  const lines = ctx.pdf.splitTextToSize(text, ctx.contentWidth);
  ctx.pdf.text(lines, ctx.margin, ctx.yPosition);
  ctx.yPosition += lines.length * 4 + 1.5;
}

function addBullet(ctx: PDFContext, text: string, size = 9): void {
  checkPageBreak(ctx, 5);
  ctx.pdf.setFontSize(size);
  ctx.pdf.setTextColor(17, 24, 39);
  ctx.pdf.setFont("helvetica", "normal");
  const lines = ctx.pdf.splitTextToSize(`• ${text}`, ctx.contentWidth - 5);
  ctx.pdf.text(lines, ctx.margin + 5, ctx.yPosition);
  ctx.yPosition += lines.length * 3.5 + 0.8;
}

function addNote(ctx: PDFContext, text: string): void {
  checkPageBreak(ctx, 6);
  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(107, 114, 128);
  ctx.pdf.setFont("helvetica", "italic");
  const lines = ctx.pdf.splitTextToSize(text, ctx.contentWidth);
  ctx.pdf.text(lines, ctx.margin, ctx.yPosition);
  ctx.yPosition += lines.length * 3 + 1.5;
}

function addSpacing(ctx: PDFContext, mm = 3): void {
  ctx.yPosition += mm;
}

const PURPLE: [number, number, number] = [124, 58, 237];
const DARK: [number, number, number] = [17, 24, 39];
const GRAY: [number, number, number] = [107, 114, 128];
const SUBTITLE_GRAY: [number, number, number] = [113, 128, 150];
const SECTION_DARK: [number, number, number] = [74, 85, 104];

const TIER_NAMES: Record<string, string> = {
  free: "Free Edition",
  essential: "Essential Edition",
  premium: "Premium Edition",
  coaching: "Complete Coaching Edition",
};

function createContext(pdf: jsPDF): PDFContext {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  return { pdf, yPosition: margin, margin, pageWidth, pageHeight, contentWidth: pageWidth - margin * 2 };
}

// ══════════════════════════════════════════════════════════════
// SECTION RENDERERS
// ══════════════════════════════════════════════════════════════

function renderCoverPage(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, tier, orderId, timestamp, narratives } = bundle;
  const bmi = profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2));
  const bmiCategory = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";

  ctx.pdf.setFontSize(30);
  ctx.pdf.setTextColor(...PURPLE);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.text("GeneWell", ctx.margin, ctx.yPosition);
  ctx.yPosition += 10;

  ctx.pdf.setFontSize(22);
  ctx.pdf.setTextColor(...DARK);
  ctx.pdf.text("Personalized Wellness Blueprint", ctx.margin, ctx.yPosition);
  ctx.yPosition += 12;

  ctx.pdf.setFontSize(20);
  ctx.pdf.setTextColor(45, 55, 72);
  ctx.pdf.text(profile.name, ctx.margin, ctx.yPosition);
  ctx.yPosition += 10;

  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...SECTION_DARK);
  ctx.pdf.text(`${TIER_NAMES[tier]} — Evidence-Based & Fully Personalized`, ctx.margin, ctx.yPosition);
  ctx.yPosition += 10;

  ctx.pdf.setDrawColor(...PURPLE);
  ctx.pdf.setLineWidth(0.5);
  ctx.pdf.line(ctx.margin, ctx.yPosition, ctx.pageWidth - ctx.margin, ctx.yPosition);
  ctx.yPosition += 8;

  ctx.pdf.setFontSize(8.5);
  ctx.pdf.setTextColor(...SUBTITLE_GRAY);
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.text(`Generated: ${new Date(timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} | Order: ${orderId}`, ctx.margin, ctx.yPosition);
  ctx.yPosition += 7;

  ctx.pdf.setFontSize(9.5);
  ctx.pdf.setTextColor(...DARK);
  ctx.pdf.text(`Age: ${profile.age} | ${profile.gender} | ${profile.heightCm}cm / ${profile.weightKg}kg | BMI: ${bmi.toFixed(1)} (${bmiCategory}) | TDEE: ${profile.tdee} kcal`, ctx.margin, ctx.yPosition);
  ctx.yPosition += 9;

  const introText = narratives.executiveSummary ||
    `Dear ${profile.name},\n\nThis wellness blueprint has been created exclusively for you based on your quiz responses, lifestyle patterns, and health goals. Every recommendation is grounded in peer-reviewed research and tailored to your unique profile.\n\nThis is not a generic plan—it reflects YOUR age, body composition, activity level, dietary preferences, stress patterns, and health concerns. Follow the steps consistently for 90 days and track your progress.`;
  ctx.pdf.setFontSize(9);
  const introLines = ctx.pdf.splitTextToSize(introText, ctx.contentWidth);
  ctx.pdf.text(introLines, ctx.margin, ctx.yPosition);

  addNewPage(ctx);
}

function renderTableOfContents(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, tier, addOns, rules } = bundle;
  
  // Filter modules based on gender to ensure clean render tree
  const activeModules = (rules.activeModules || []).filter(m => {
    if (profile.gender === "male") {
      return !["pcos_protocol", "ovarian_health", "menstrual_cycle", "women_hormone"].includes(m);
    }
    if (profile.gender === "female") {
      return !["prostate_health", "testosterone_optimization", "men_performance"].includes(m);
    }
    return true;
  });

  addHeaderSection(ctx, "What's Inside Your Blueprint");

  const tocItems: string[] = ["Your Top 3 Priority Actions", "Wellness Baseline Assessment"];

  if (tier !== "free") {
    tocItems.push("Metabolic Profile & Body Composition Analysis");
    tocItems.push("Personalized Nutrition Strategy");
  }

  if ((tier === "premium" || tier === "coaching") && bundle.mealPlan?.days?.length > 0) {
    tocItems.push("7-Day Personalized Meal Plan");
  }

  tocItems.push("Sleep Optimization Protocol");

  if (tier !== "free") {
    tocItems.push("Movement & Training Program");
  }

  tocItems.push("Stress Management Framework");

  if (activeModules.includes("gut_health") && tier !== "free" && profile.digestiveIssues?.length > 0) {
    tocItems.push("Digestive Health & Gut Protocol");
  }

  if (activeModules.includes("skin_health") && (tier === "premium" || tier === "coaching") && profile.skinConcerns?.length > 0) {
    tocItems.push("Dermatological Wellness & Skin Health");
  }

  if (activeModules.includes("insulin_management")) tocItems.push("Glycemic Control & Insulin Sensitivity");
  if (activeModules.includes("thyroid_protocol")) tocItems.push("Thyroid Health & Endocrine Support");
  if (activeModules.includes("cardiovascular")) tocItems.push("Cardiovascular Health & Lipid Profile");

  if (tier === "premium" || tier === "coaching") {
    tocItems.push("Supplement Strategy & Micronutrient Support");
    tocItems.push("Recommended Pathology Lab Tests");
  } else if (rules.labTestPriority?.length > 0) {
    tocItems.push("Recommended Pathology Lab Tests");
  }

  if (addOns?.length > 0) {
    tocItems.push("Specialized Add-On Modules");
  }

  if (tier === "coaching") {
    tocItems.push("Habit Formation & Mindset Coaching");
  }

  tocItems.push("Progress Tracking & Weekly Check-ins");
  tocItems.push("Action Plan & Closing Thoughts");

  tocItems.forEach((item, index) => {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(11);
    ctx.pdf.text(`${index + 1}. ${item}`, ctx.margin + 5, ctx.yPosition);
    ctx.yPosition += 8;

    if (ctx.yPosition > 270) {
      addNewPage(ctx);
    }
  });

  addNewPage(ctx);
}

const SECTION_TITLES: Record<string, string> = {
  executive_summary: "Clinical Overview",
  metabolic_profile: "Metabolic Analysis",
  sleep_protocol: "Sleep Optimization",
  stress_management: "Stress Resilience",
  nutrition_strategy: "Nutrition Strategy",
  movement_program: "Training Program",
  beginner_program: "Starter Movement Plan",
  fat_loss_program: "Fat Loss Strategy",
  muscle_building: "Hypertrophy Framework",
  insulin_management: "Blood Sugar Control",
  gut_health: "Digestive Health",
  skin_health: "Skin Nutrition",
  lab_tests: "Biomarker Recommendations",
};

function renderTopActions(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, rules } = bundle;
  const hints = rules.narrativeHints || [];

  addHeaderSection(ctx, `${profile.name}'s Top 3 Priority Actions`, "Start here — these three changes will create the biggest impact in your first week");

  if (hints.length >= 3) {
    hints.slice(0, 3).forEach((hint, i) => {
      const title = SECTION_TITLES[hint.section] || hint.section;
      ctx.pdf.setFontSize(12);
      ctx.pdf.setTextColor(...PURPLE);
      ctx.pdf.setFont("helvetica", "bold");
      checkPageBreak(ctx, 6);
      ctx.pdf.text(`${i + 1}. ${title}`, ctx.margin, ctx.yPosition);
      ctx.yPosition += 6;
      addText(ctx, hint.focusAreas.join(". "), 9);
      addSpacing(ctx, 3);
    });
  } else {
    ctx.pdf.setFontSize(12);
    ctx.pdf.setTextColor(...PURPLE);
    ctx.pdf.setFont("helvetica", "bold");
    checkPageBreak(ctx, 6);
    ctx.pdf.text("1. Lock Your Wake-Sleep Schedule", ctx.margin, ctx.yPosition);
    ctx.yPosition += 6;
    addText(ctx, `Your sleep score is ${profile.sleepScore}/100 — ${profile.sleepScore < 50 ? "this is critical for you" : profile.sleepScore < 70 ? "there's significant room for improvement" : "maintaining consistency will sustain your good sleep"}. Consistent wake times improve sleep quality more than sleeping longer (Journal of Clinical Sleep Medicine, 2023).`, 9);
    addSpacing(ctx, 3);

    ctx.pdf.setFontSize(12);
    ctx.pdf.setTextColor(...PURPLE);
    ctx.pdf.setFont("helvetica", "bold");
    checkPageBreak(ctx, 6);
    ctx.pdf.text("2. Structure Your Eating Window", ctx.margin, ctx.yPosition);
    ctx.yPosition += 6;
    addText(ctx, `Eat within a 10-12 hour window. Time-restricted eating improved metabolic markers by 15-25% independent of calorie changes (Cell Metabolism, 2023). Your estimated TDEE is ${profile.tdee} kcal/day.`, 9);
    addSpacing(ctx, 3);

    ctx.pdf.setFontSize(12);
    ctx.pdf.setTextColor(...PURPLE);
    ctx.pdf.setFont("helvetica", "bold");
    checkPageBreak(ctx, 6);
    ctx.pdf.text("3. Move for 20-30 Minutes Daily", ctx.margin, ctx.yPosition);
    ctx.yPosition += 6;
    const exerciseSuggestion = profile.exercisePreference?.length > 0
      ? `Based on your preferences (${profile.exercisePreference.slice(0, 2).join(", ")}), start with those activities.`
      : "Walking, yoga, or bodyweight exercises are ideal starting points.";
    addText(ctx, `${exerciseSuggestion} Even 20 minutes of moderate activity reduces all-cause mortality by 30% (JAMA Internal Medicine, 2022). Your current activity score is ${profile.activityScore}/100.`, 9);
  }

  addSpacing(ctx, 4);
  addNote(ctx, "Implementation tip: Start with Action 1 this week. Add Action 2 in week 2. Add Action 3 in week 3. Building one habit at a time has a 85% higher success rate (European Journal of Social Psychology, 2022).");
  addNewPage(ctx);
}

function renderWellnessBaseline(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, narratives } = bundle;

  addHeaderSection(ctx, "Your Wellness Baseline Assessment", `${profile.name}'s current health snapshot based on quiz analysis`);

  if (narratives.riskInterpretation) {
    addText(ctx, narratives.riskInterpretation, 9);
  } else if (narratives.executiveSummary) {
    addText(ctx, narratives.executiveSummary, 9);
  }
  addSpacing(ctx, 3);

  addSubSection(ctx, "Health Scores");
  const scores = [
    { label: "Energy Level", score: profile.energyScore, interpretation: profile.energyScore < 40 ? "Needs immediate attention — likely linked to sleep, nutrition, or stress" : profile.energyScore < 60 ? "Below optimal — targeted changes will help significantly" : profile.energyScore < 80 ? "Good baseline — fine-tuning will elevate further" : "Excellent — focus on maintaining consistency" },
    { label: "Sleep Quality", score: profile.sleepScore, interpretation: profile.sleepScore < 40 ? "Critical — sleep is likely impacting all other health areas" : profile.sleepScore < 60 ? "Moderate — sleep protocol will be transformative for you" : profile.sleepScore < 80 ? "Decent — small adjustments will yield noticeable gains" : "Strong — maintain your current sleep habits" },
    { label: "Stress Resilience", score: profile.stressScore, interpretation: profile.stressScore < 40 ? "High stress load — nervous system support is priority" : profile.stressScore < 60 ? "Elevated stress — daily management techniques are essential" : profile.stressScore < 80 ? "Manageable — proactive tools will prevent burnout" : "Well-managed — continue current practices" },
    { label: "Physical Activity", score: profile.activityScore, interpretation: profile.activityScore < 40 ? "Sedentary — gradual movement introduction needed" : profile.activityScore < 60 ? "Light activity — structured exercise will boost energy" : profile.activityScore < 80 ? "Active — progressive training will optimize results" : "Highly active — recovery and nutrition are key priorities" },
  ];
  scores.forEach(({ label, score, interpretation }) => addText(ctx, `${label}: ${score}/100 — ${interpretation}`, 9));

  if (profile.medicalConditions?.length > 0) {
    addSpacing(ctx, 3);
    addSubSection(ctx, "Health Considerations");
    addText(ctx, "The following conditions have been factored into your recommendations:", 9);
    profile.medicalConditions.forEach(c => addBullet(ctx, c, 8));
    addNote(ctx, "Always consult your physician before making significant changes, especially with existing health conditions.");
  }

  if (profile.foodIntolerances?.length > 0) {
    addSpacing(ctx, 2);
    addSubSection(ctx, "Dietary Sensitivities");
    addText(ctx, "Your nutrition plan accounts for these intolerances:", 9);
    profile.foodIntolerances.forEach(f => addBullet(ctx, f, 8));
  }

  addNewPage(ctx);
}

function renderMetabolicProfile(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile } = bundle;
  const bmi = profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2));
  const bmiCategory = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";

  addHeaderSection(ctx, "Your Metabolic Profile", `${profile.name}'s personalized energy and body composition analysis`);
  addText(ctx, "Understanding your metabolism is the foundation for effective nutrition. These numbers are calculated using the Mifflin-St Jeor equation (the most accurate non-laboratory method, validated in the American Journal of Clinical Nutrition).", 9);
  addSpacing(ctx, 3);

  addText(ctx, `Basal Metabolic Rate (BMR): ${profile.bmr} kcal/day`, 10, DARK, true);
  addText(ctx, "This is the energy your body burns at complete rest — breathing, circulation, cell repair, brain function.", 8, GRAY);
  addSpacing(ctx, 2);

  addText(ctx, `Total Daily Energy Expenditure (TDEE): ${profile.tdee} kcal/day`, 10, DARK, true);
  addText(ctx, `This includes your BMR plus the energy burned through daily activity. Based on your ${profile.workSchedule || "work"} schedule and ${profile.exerciseIntensity || "moderate"} exercise intensity.`, 8, GRAY);
  addSpacing(ctx, 2);

  addText(ctx, `Body Mass Index (BMI): ${bmi.toFixed(1)} — ${bmiCategory}`, 10, DARK, true);
  addText(ctx, "BMI is a screening tool, not a definitive health measure. Muscle mass, bone density, and body fat distribution matter more than the number alone.", 8, GRAY);
  addSpacing(ctx, 4);

  addSubSection(ctx, "Calorie Targets by Goal");
  addText(ctx, `To maintain current weight: ~${profile.tdee} kcal/day`, 9);
  addText(ctx, `To lose fat (moderate deficit): ${profile.tdee - 400} - ${profile.tdee - 500} kcal/day`, 9);
  addText(ctx, "A 400-500 calorie deficit produces 0.4-0.5 kg fat loss per week — the optimal rate for preserving muscle (JISSN, 2021).", 8, GRAY);
  addText(ctx, `To gain lean mass: ${profile.tdee + 250} - ${profile.tdee + 400} kcal/day`, 9);
  addSpacing(ctx, 4);

  addSubSection(ctx, "Daily Macronutrient Targets");
  const proteinPct = Math.round(((profile.proteinGrams * 4) / profile.tdee) * 100);
  const carbsPct = Math.round(((profile.carbsGrams * 4) / profile.tdee) * 100);
  const fatsPct = Math.round(((profile.fatsGrams * 9) / profile.tdee) * 100);
  const isVeg = profile.dietaryPreference?.toLowerCase().includes("veg") || profile.dietaryPreference?.toLowerCase().includes("plant");

  addText(ctx, `Protein: ${profile.proteinGrams}g/day (${proteinPct}% of total calories)`, 9, DARK, true);
  addText(ctx, `Essential for your ${profile.weightKg}kg body weight to preserve lean mass. ${isVeg ? "Focus on paneer, sprouts, and Greek yogurt." : "Prioritize lean meats, eggs, and fish."}`, 8, GRAY);

  addText(ctx, `Carbohydrates: ${profile.carbsGrams}g/day (${carbsPct}% of total calories)`, 9, DARK, true);
  addText(ctx, `Tailored to your ${profile.activityScore > 60 ? "active" : "moderate"} lifestyle. Focus on slow-releasing complex carbs.`, 8, GRAY);

  addText(ctx, `Healthy Fats: ${profile.fatsGrams}g/day (${fatsPct}% of total calories)`, 9, DARK, true);
  addText(ctx, `Critical for hormonal health at age ${profile.age}. Use ghee, olive oil, and nuts.`, 8, GRAY);

  addNewPage(ctx);
}

function renderNutritionStrategy(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, narratives } = bundle;
  const isVeg = profile.dietaryPreference?.toLowerCase().includes("veg") || profile.dietaryPreference?.toLowerCase().includes("plant");
  const isVegan = profile.dietaryPreference?.toLowerCase().includes("vegan");

  addHeaderSection(ctx, "Personalized Nutrition Strategy", `${profile.name}'s exact macronutrient breakdown: ${profile.tdee} kcal`);

  addSubSection(ctx, `Target Macros: P:${profile.proteinGrams}g | C:${profile.carbsGrams}g | F:${profile.fatsGrams}g`);

  if (narratives.nutritionNarrative) {
    addText(ctx, narratives.nutritionNarrative, 9);
  } else {
    addText(ctx, `This plan is calculated specifically for a ${profile.age}-year old ${profile.gender} weighing ${profile.weightKg}kg with a goal of ${profile.activityScore > 50 ? "performance" : "wellness"}.`, 9);
  }
  addSpacing(ctx, 3);

  addSubSection(ctx, "Core Nutrition Principles");
  addText(ctx, "Build every meal with these four components:", 9);
  if (isVegan) {
    addBullet(ctx, "Protein: Tofu, tempeh, legumes (dal, chickpeas, rajma), seitan, quinoa", 8);
    addBullet(ctx, "Complex Carbs: Brown rice, millets (ragi, jowar), sweet potato, oats, quinoa", 8);
    addBullet(ctx, "Vegetables: Minimum 3 servings/day — spinach, broccoli, bell peppers, carrots, gourds", 8);
    addBullet(ctx, "Healthy Fats: Coconut oil, olive oil, flaxseeds, chia seeds, walnuts, avocado", 8);
  } else if (isVeg) {
    addBullet(ctx, "Protein: Paneer, Greek yogurt, eggs, dal (moong/arhar/masoor), chickpeas, tofu", 8);
    addBullet(ctx, "Complex Carbs: Brown rice, whole wheat roti, oats, millets, sweet potato", 8);
    addBullet(ctx, "Vegetables: Minimum 3 servings/day — spinach, broccoli, bell peppers, gourds, beans", 8);
    addBullet(ctx, "Healthy Fats: Ghee, olive oil, nuts (almonds, walnuts), seeds, coconut", 8);
  } else {
    addBullet(ctx, "Protein: Chicken breast, fish (salmon, mackerel), eggs, paneer, dal, legumes", 8);
    addBullet(ctx, "Complex Carbs: Brown rice, whole wheat roti, oats, millets, sweet potato", 8);
    addBullet(ctx, "Vegetables: Minimum 3 servings/day — spinach, broccoli, bell peppers, carrots, gourds", 8);
    addBullet(ctx, "Healthy Fats: Ghee, olive oil, nuts (almonds, walnuts), fatty fish, seeds", 8);
  }

  if (profile.foodIntolerances?.length > 0) {
    addSpacing(ctx, 2);
    addSubSection(ctx, "Substitutions for Your Intolerances");
    profile.foodIntolerances.forEach(intolerance => {
      const lower = intolerance.toLowerCase();
      if (lower.includes("lactose") || lower.includes("dairy")) {
        addBullet(ctx, "Dairy-free: Use almond/oat milk, coconut yogurt, tofu instead of paneer", 8);
      } else if (lower.includes("gluten") || lower.includes("wheat")) {
        addBullet(ctx, "Gluten-free: Use rice, millets (ragi, jowar, bajra), quinoa, buckwheat instead of wheat", 8);
      } else if (lower.includes("nut")) {
        addBullet(ctx, "Nut-free: Use seeds (sunflower, pumpkin), coconut, soy for healthy fats", 8);
      } else if (lower.includes("soy")) {
        addBullet(ctx, "Soy-free: Use paneer, chickpea flour, and hemp protein as alternatives", 8);
      } else {
        addBullet(ctx, `${intolerance}: Substitute with similar nutrient-dense alternatives`, 8);
      }
    });
  }

  addSpacing(ctx, 3);
  addSubSection(ctx, "Hydration Protocol");
  addBullet(ctx, `Upon waking: 500ml warm water (rehydrates after ${profile.sleepScore < 60 ? "disrupted" : "overnight"} sleep)`, 8);
  addBullet(ctx, "Before meals: 250ml water 20 min prior (improves digestion and satiety)", 8);
  addBullet(ctx, `Daily target: ${Math.round(profile.weightKg * 0.033 * 10) / 10} liters (0.033L per kg body weight)`, 8);
  addBullet(ctx, "Post-exercise: 500ml per 30 minutes of activity", 8);
  addNote(ctx, "Ref: European Journal of Nutrition (2021) — adequate hydration improves cognitive function by 14% and reduces fatigue.");

  addNewPage(ctx);
}

function renderMealPlan(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, mealPlan } = bundle;
  if (!mealPlan?.days?.length) return;

  addHeaderSection(ctx, "7-Day Meal Plan", `Customized for ${profile.name}'s ${profile.dietaryPreference || "balanced"} diet — ${profile.tdee} kcal target`);

  const renderMealItems = (label: string, items: MealItem[]) => {
    if (!items?.length) return;
    addText(ctx, `${label}:`, 9, DARK, true);
    items.forEach(item => {
      checkPageBreak(ctx, 5);
      ctx.pdf.setFontSize(8);
      ctx.pdf.setTextColor(...DARK);
      ctx.pdf.setFont("helvetica", "normal");
      const line = `  ${item.name} — ${item.portion} | ${item.calories} kcal | P:${item.protein}g C:${item.carbs}g F:${item.fats}g`;
      const lines = ctx.pdf.splitTextToSize(line, ctx.contentWidth - 5);
      ctx.pdf.text(lines, ctx.margin + 5, ctx.yPosition);
      ctx.yPosition += lines.length * 3.2 + 0.5;
    });
  };

  mealPlan.days.forEach((day: DayMeal, idx: number) => {
    if (idx > 0 && idx % 2 === 0) addNewPage(ctx);
    checkPageBreak(ctx, 40);

    addText(ctx, `${day.dayLabel} — Total: ${day.totalCalories} kcal | P:${day.totalProtein}g C:${day.totalCarbs}g F:${day.totalFats}g`, 10, PURPLE, true);
    addSpacing(ctx, 1);

    renderMealItems("Breakfast", day.breakfast);
    renderMealItems("Mid-Morning Snack", day.midMorningSnack);
    renderMealItems("Lunch", day.lunch);
    renderMealItems("Evening Snack", day.eveningSnack);
    renderMealItems("Dinner", day.dinner);

    addSpacing(ctx, 3);
  });

  if (mealPlan.dietaryNotes?.length > 0) {
    addSpacing(ctx, 2);
    addSubSection(ctx, "Dietary Notes");
    mealPlan.dietaryNotes.forEach(note => addBullet(ctx, note, 8));
  }

  addNote(ctx, `Daily target: ~${mealPlan.dailyTargetCalories} kcal. Portion sizes are calibrated to your metabolic profile. Adjust portions by 10-15% if you feel consistently hungry or overfull.`);
  addNewPage(ctx);
}

function renderSleepProtocol(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, narratives, tier, rules } = bundle;
  const severity = rules.severityProfile?.sleepSeverity || "normal";

  addHeaderSection(ctx, "Sleep Optimization Protocol", `${profile.name}'s recovery foundation — Score: ${profile.sleepScore}/100`);

  if (narratives.sleepNarrative) {
    addText(ctx, narratives.sleepNarrative, 9);
  }
  addSpacing(ctx, 3);

  addSubSection(ctx, "Evidence-Based Sleep Hygiene");
  addBullet(ctx, "Consistent schedule: Sleep at the same time nightly, wake at the same time — even weekends. Variability of >60 min increases cardiovascular risk by 27% (European Heart Journal, 2020).", 8);
  addBullet(ctx, "Room darkness: <5 lux light exposure. Use blackout curtains or an eye mask. Even dim light during sleep reduces melatonin by 50% (PNAS, 2022).", 8);
  addBullet(ctx, "Cool temperature: 18-20°C (65-68°F). Core body temperature must drop 1-2°F to initiate sleep.", 8);
  addBullet(ctx, "No screens 60-90 min before bed. Blue light (450-495nm) suppresses melatonin production by up to 85% (Harvard Health, 2021).", 8);
  addBullet(ctx, "No caffeine after 2 PM. Caffeine has a 5-6 hour half-life.", 8);
  addBullet(ctx, "Pre-bed routine: Warm shower/bath 90 min before bed triggers vasodilation and accelerates core temperature drop (Sleep Medicine Reviews, 2019).", 8);

  if (tier !== "free") {
    addSpacing(ctx, 3);
    addSubSection(ctx, "Sleep Supplements (Use Only if Protocol Alone is Insufficient)");
    addBullet(ctx, "Magnesium Glycinate: 300-400mg, 60 min before bed. The glycinate form is best absorbed and least likely to cause GI issues.", 8);
    addBullet(ctx, "L-Theanine: 100-200mg. An amino acid from green tea that promotes alpha brain waves (relaxation without drowsiness).", 8);
    addBullet(ctx, "Ashwagandha (KSM-66): 300mg before bed if stress-related insomnia. Reduces cortisol by 23% (Journal of Clinical Medicine, 2021).", 8);
    addNote(ctx, "Try the sleep hygiene protocol for 2 weeks minimum before adding supplements. Add one at a time to identify what works for you.");
  }

  if (profile.workSchedule?.toLowerCase().includes("night") || profile.workSchedule?.toLowerCase().includes("shift")) {
    addSpacing(ctx, 2);
    addSubSection(ctx, "Shift Worker Adaptations");
    addBullet(ctx, "Use blackout curtains for daytime sleep — simulate nighttime darkness", 8);
    addBullet(ctx, "Take 0.5mg melatonin 30 min before desired sleep time on shift days", 8);
    addBullet(ctx, "Wear blue-light blocking glasses during the last 2 hours of your shift", 8);
    addBullet(ctx, "Keep meal times consistent even if sleep times vary", 8);
  }

  addNewPage(ctx);
}

function renderMovementProgram(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, narratives, rules, tier } = bundle;
  const modules = rules.activeModules || [];
  const isBeginner = modules.includes("beginner_program");
  if (!modules.includes("movement_program") && !isBeginner) return;

  const title = isBeginner ? "Starter Movement Plan" : "Movement & Training Program";
  addHeaderSection(ctx, title, `${profile.name}'s personalized exercise protocol — Activity Score: ${profile.activityScore}/100`);

  if (narratives.movementNarrative) {
    addText(ctx, narratives.movementNarrative, 9);
    addSpacing(ctx, 2);
  }

  const exercisePrefs = profile.exercisePreference || [];
  const prefText = exercisePrefs.length > 0 ? `Your preferred activities (${exercisePrefs.join(", ")}) have been incorporated where possible.` : "This program uses fundamental movement patterns suitable for all fitness levels.";
  addText(ctx, `${prefText} ${profile.activityScore < 40 ? "Given your sedentary baseline, we start conservatively and build gradually." : profile.activityScore < 60 ? "Your moderate activity level means you can handle progressive challenges." : "Your strong fitness base allows for more advanced programming."}`, 9);
  addSpacing(ctx, 3);

  if (tier === "essential") {
    addSubSection(ctx, "3-Day Foundation Program");
    addText(ctx, `Designed for sustainable habit building at your current activity level (${profile.activityScore}/100). Each session is 25-35 minutes.`, 9);
    addSpacing(ctx, 2);
    addText(ctx, "Day 1 (Mon/Tue): Full Body Strength", 9, DARK, true);
    addBullet(ctx, "Warm-up: 5 min light movement (marching, arm circles)", 8);
    addBullet(ctx, "Squats or wall sits: 3 sets x 10-15 reps", 8);
    addBullet(ctx, "Push-ups (or knee push-ups): 3 sets x 8-12 reps", 8);
    addBullet(ctx, "Dumbbell rows or resistance band rows: 3 sets x 10-12 reps each side", 8);
    addBullet(ctx, "Plank hold: 3 sets x 20-45 seconds", 8);
    addBullet(ctx, "Cool-down: 5 min stretching", 8);
    addSpacing(ctx, 2);
    addText(ctx, "Day 2 (Wed/Thu): Zone 2 Cardio — 30 minutes", 9, DARK, true);
    addBullet(ctx, "Brisk walk, light jog, cycling, or swimming at conversational pace", 8);
    addNote(ctx, "Zone 2 cardio builds mitochondrial density and fat oxidation capacity (Dr. Peter Attia / Inigo San Millan research).");
    addSpacing(ctx, 2);
    addText(ctx, "Day 3 (Fri/Sat): Flexibility & Recovery — 20 minutes", 9, DARK, true);
    addBullet(ctx, "Yoga flow or full-body stretching routine", 8);
    addBullet(ctx, "Focus on hip flexors, hamstrings, shoulders, and spine mobility", 8);
    addBullet(ctx, "Deep breathing throughout (4-count inhale, 6-count exhale)", 8);
  } else if (tier === "premium") {
    addSubSection(ctx, "5-Day Progressive Program");
    addText(ctx, `Intermediate program with periodized training. Each session: 40-50 minutes.`, 9);
    addSpacing(ctx, 2);
    addText(ctx, "Monday: Lower Body Strength", 9, DARK, true);
    addBullet(ctx, "Barbell/goblet squats: 4 sets x 8-12 reps", 8);
    addBullet(ctx, "Romanian deadlifts: 3 sets x 10-12 reps", 8);
    addBullet(ctx, "Walking lunges: 3 sets x 10 each leg", 8);
    addBullet(ctx, "Leg press or leg curls: 3 sets x 12-15 reps", 8);
    addSpacing(ctx, 2);
    addText(ctx, "Tuesday: Upper Body Push", 9, DARK, true);
    addBullet(ctx, "Bench press or dumbbell press: 4 sets x 8-10 reps", 8);
    addBullet(ctx, "Overhead press: 3 sets x 8-12 reps", 8);
    addBullet(ctx, "Incline dumbbell press: 3 sets x 10-12 reps", 8);
    addBullet(ctx, "Lateral raises: 3 sets x 12-15 reps", 8);
    addSpacing(ctx, 2);
    addText(ctx, "Wednesday: Active Recovery + Zone 2 Cardio", 9, DARK, true);
    addBullet(ctx, "30 min brisk walk, light cycling, or swimming", 8);
    addBullet(ctx, "10 min mobility work and foam rolling", 8);
    addSpacing(ctx, 2);
    addText(ctx, "Thursday: Upper Body Pull", 9, DARK, true);
    addBullet(ctx, "Pull-ups or lat pulldown: 4 sets x 8-10 reps", 8);
    addBullet(ctx, "Barbell or cable rows: 3 sets x 10-12 reps", 8);
    addBullet(ctx, "Face pulls: 3 sets x 15-20 reps", 8);
    addBullet(ctx, "Bicep curls: 3 sets x 10-12 reps", 8);
    addSpacing(ctx, 2);
    addText(ctx, "Friday: Full Body Power + Core", 9, DARK, true);
    addBullet(ctx, "Deadlifts: 4 sets x 5-8 reps", 8);
    addBullet(ctx, "Kettlebell swings: 3 sets x 15 reps", 8);
    addBullet(ctx, "Box jumps or jump squats: 3 sets x 8 reps", 8);
    addBullet(ctx, "Hanging leg raises: 3 sets x 10-15 reps", 8);
    addSpacing(ctx, 2);
    addText(ctx, "Saturday & Sunday: Rest or light activity (walking, yoga, sports)", 9);
  } else if (tier === "coaching") {
    addSubSection(ctx, "6-Day Periodized Program");
    addText(ctx, `Advanced program with 12-week periodization for maximal results.`, 9);
    addSpacing(ctx, 2);
    addText(ctx, "Phase 1 — Strength Foundation (Weeks 1-4)", 9, DARK, true);
    addBullet(ctx, "Mon: Lower body (squat focus) | Tue: Upper push | Wed: Zone 2 cardio + core", 8);
    addBullet(ctx, "Thu: Lower body (hinge focus) | Fri: Upper pull | Sat: Full body power", 8);
    addBullet(ctx, "Rep range: 6-10 reps | Rest: 2-3 min | Focus: progressive overload", 8);
    addSpacing(ctx, 2);
    addText(ctx, "Phase 2 — Hypertrophy (Weeks 5-8)", 9, DARK, true);
    addBullet(ctx, "Same split, increased volume: 10-15 reps | Rest: 60-90 sec", 8);
    addBullet(ctx, "Add drop sets and supersets for metabolic stress", 8);
    addBullet(ctx, "Include 2 Zone 2 cardio sessions (30 min each)", 8);
    addSpacing(ctx, 2);
    addText(ctx, "Phase 3 — Peak Performance (Weeks 9-12)", 9, DARK, true);
    addBullet(ctx, "Mixed rep ranges: strength (4-6) + hypertrophy (10-12) + endurance (15-20)", 8);
    addBullet(ctx, "Add HIIT 1-2x per week for metabolic conditioning", 8);
    addBullet(ctx, "Deload week 12: reduce volume 40%, maintain intensity", 8);
  }

  addSpacing(ctx, 3);
  addSubSection(ctx, "Progressive Overload Principle");
  addText(ctx, "To continue improving, gradually increase demands on your body:", 9);
  addBullet(ctx, "Add 2.5-5% weight when you complete all target reps for 2 consecutive sessions", 8);
  addBullet(ctx, "If stuck on a weight for 3+ sessions, try adding 1 rep instead of weight", 8);
  addBullet(ctx, "Track every workout — what gets measured gets managed", 8);
  addNote(ctx, "Ref: Schoenfeld et al. (2021) — progressive overload is the single most important variable for strength and muscle gain.");

  addNewPage(ctx);
}

function renderStressManagement(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, narratives, tier } = bundle;

  addHeaderSection(ctx, "Stress Management & Mental Wellness", `${profile.name}'s daily resilience toolkit — Stress Score: ${profile.stressScore}/100`);

  if (narratives.stressNarrative) {
    addText(ctx, narratives.stressNarrative, 9);
  }
  addSpacing(ctx, 3);

  addSubSection(ctx, "Immediate Stress Relief Tools (Use Anytime)");
  addBullet(ctx, "Box Breathing: Inhale 4 sec → Hold 4 sec → Exhale 4 sec → Hold 4 sec. Repeat 4-6 cycles. Activates parasympathetic nervous system within 5 minutes (Frontiers in Human Neuroscience, 2023).", 8);
  addBullet(ctx, "Physiological Sigh: 2 short inhales through nose + 1 long exhale through mouth. The fastest known method to reduce stress in real-time (Stanford, 2023).", 8);
  addBullet(ctx, "5-4-3-2-1 Grounding: Notice 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste. Breaks anxiety loops by engaging sensory cortex.", 8);
  addBullet(ctx, `Physical movement: Even a 10-min walk reduces cortisol by 15%. Your activity score (${profile.activityScore}/100) suggests ${profile.activityScore < 50 ? "adding more daily movement would significantly benefit your stress levels" : "you're using movement well as a stress tool"}.`, 8);

  if (tier !== "free") {
    addSpacing(ctx, 3);
    addSubSection(ctx, "Daily Stress Prevention Protocol");
    addBullet(ctx, "Morning: 5-10 min meditation or breathwork (before checking phone). Apps: Headspace, Calm, Insight Timer (free).", 8);
    addBullet(ctx, "Midday: 5-min walking break every 90 minutes of seated work. Prevents cortisol accumulation.", 8);
    addBullet(ctx, "Evening: 15-20 min tech-free wind-down routine. Journal 3 things you're grateful for (shown to reduce anxiety by 23% in 2 weeks).", 8);
    addBullet(ctx, "Weekly: 1 hour in nature (forest, park, garden). Nature exposure reduces cortisol by 12% per hour.", 8);
    addBullet(ctx, "Social connection: 30+ min meaningful interaction 3x/week. Social isolation increases stress hormones comparable to smoking.", 8);
  }

  if (tier === "coaching") {
    addSpacing(ctx, 3);
    addSubSection(ctx, "Advanced Stress Resilience Techniques");
    addBullet(ctx, "Cold exposure: Start with 30-sec cold water at end of shower. Gradually increase to 2-3 min. Activates vagus nerve.", 8);
    addBullet(ctx, "Non-sleep deep rest (NSDR): 10-20 min guided relaxation lying down. Restores dopamine levels by 65% (Nature Neuroscience, 2022).", 8);
    addBullet(ctx, "Journaling: Write for 15 min about stressful events. Expressive writing reduces cortisol and improves immune function.", 8);
    addBullet(ctx, "Progressive Muscle Relaxation: Tense each muscle group for 5 sec, release for 10 sec. Scan from feet to head.", 8);
  }

  addNewPage(ctx);
}

function renderConditionModules(ctx: PDFContext, bundle: PDFDataBundle): void {
  const conditionNarratives = bundle.narratives.conditionNarratives || {};
  const conditions = Object.keys(conditionNarratives);
  if (conditions.length === 0) return;

  addHeaderSection(ctx, "Condition-Specific Protocols", "Evidence-based guidance tailored to your health conditions");

  conditions.forEach(condition => {
    const narrative = conditionNarratives[condition];
    if (!narrative) return;

    addSubSection(ctx, condition.charAt(0).toUpperCase() + condition.slice(1).replace(/_/g, " ") + " Management");
    addText(ctx, narrative, 9);
    addSpacing(ctx, 4);
  });

  addNewPage(ctx);
}

function renderSupplementStrategy(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile } = bundle;

  addHeaderSection(ctx, "Smart Supplement Strategy", `${profile.name}'s evidence-based nutritional support`);

  addText(ctx, "Supplements fill nutritional gaps — they don't replace real food. Start with diet optimization first. Add supplements one at a time, waiting 2 weeks between additions to assess impact.", 9);
  addSpacing(ctx, 3);

  if (profile.supplementPriority?.length > 0) {
    addSubSection(ctx, "Your Priority Supplement Stack");
    profile.supplementPriority.forEach((supp, idx) => addText(ctx, `${idx + 1}. ${supp}`, 9));
    addSpacing(ctx, 3);
  }

  addSubSection(ctx, "Supplement Timing Protocol");
  addText(ctx, "Morning (with breakfast):", 9, DARK, true);
  addBullet(ctx, "Vitamin D3: 2000-4000 IU — 76% of Indians are deficient (IJMR, 2023). Take with fat for absorption.", 8);
  addBullet(ctx, "Omega-3 (EPA+DHA): 1-2g — anti-inflammatory, brain and heart health.", 8);
  addBullet(ctx, "B-Complex: If vegetarian/vegan — B12 deficiency is common in plant-based diets", 8);
  addSpacing(ctx, 2);

  addText(ctx, "Pre-workout (if exercising):", 9, DARK, true);
  addBullet(ctx, "Creatine Monohydrate: 3-5g daily — the most researched supplement for strength and cognitive function", 8);
  addSpacing(ctx, 2);

  addText(ctx, "Evening (60 min before bed):", 9, DARK, true);
  addBullet(ctx, "Magnesium Glycinate: 300-400mg — supports sleep, reduces muscle cramps, calms nervous system", 8);
  addBullet(ctx, "Ashwagandha (KSM-66): 300-600mg — adaptogen that reduces cortisol by 23% (if stress is elevated)", 8);
  addSpacing(ctx, 3);

  addSubSection(ctx, "Quality Standards");
  addBullet(ctx, "Look for third-party testing: USP, NSF, or FSSAI certification", 8);
  addBullet(ctx, "Avoid proprietary blends — dosages should be clearly listed", 8);
  addBullet(ctx, "Store in cool, dry place away from sunlight", 8);
  addBullet(ctx, "Consult your physician before starting, especially if on medication", 8);

  addNewPage(ctx);
}

function renderLabTests(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, rules, tier } = bundle;
  const tests = [...(rules.labTestPriority || [])].sort((a, b) => a.priority - b.priority);

  addHeaderSection(ctx, "Recommended Pathology Lab Tests", `${profile.name}'s personalized diagnostic panel based on your health profile`);

  addText(ctx, "Moving from guesswork to data-driven health decisions requires clinical testing. These tests are recommended specifically for YOU based on your quiz responses, health scores, BMI, medical conditions, and wellness goals. All tests are standard pathology panels available at major Indian diagnostic centers (Thyrocare, Dr. Lal PathLabs, SRL Diagnostics, Metropolis).", 9);
  addSpacing(ctx, 2);

  if (tests.length > 0) {
    addSubSection(ctx, "Priority Tests (Ranked by Importance)");
    tests.forEach(test => {
      checkPageBreak(ctx, 12);
      const priorityBadge = test.priority <= 1 ? "🔴 CRITICAL" : test.priority <= 3 ? "🟡 HIGH" : "🟢 STANDARD";
      addText(ctx, `${test.name} — ${priorityBadge}`, 9, DARK, true);
      addText(ctx, `Reason: ${test.reason}`, 8, GRAY);
      addText(ctx, `Cost: ${test.estimatedCostINR} | Frequency: ${test.frequency}`, 8, SECTION_DARK);
      addSpacing(ctx, 1);
    });
  } else {
    addSubSection(ctx, "Priority Tests (Based on Your Profile)");
    addBullet(ctx, "Complete Blood Count (CBC) — Baseline health marker. Cost: Rs.200-400.", 8);
    addBullet(ctx, "Fasting Blood Glucose (FBS) — Screens for pre-diabetes and diabetes. Cost: Rs.80-150.", 8);
    addBullet(ctx, "Vitamin D (25-hydroxyvitamin D) — 76% of urban Indians are deficient. Cost: Rs.600-1,200.", 8);

    if (profile.energyScore < 50 || profile.medicalConditions?.some(c => c.toLowerCase().includes("thyroid"))) {
      addBullet(ctx, "Thyroid Profile (T3, T4, TSH, Anti-TPO) — Critical for metabolic regulation and fatigue assessment. Cost: Rs.400-800.", 8);
    }
    if (profile.stressScore < 50 || profile.sleepScore < 50) {
      addBullet(ctx, "Vitamin B12 & Folate — Foundational for nervous system health. Cost: Rs.500-900.", 8);
    }
    const bmi = profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2));
    if (bmi > 25 || profile.digestiveIssues?.length > 0) {
      addBullet(ctx, "HbA1c & Fasting Insulin — 3-month blood sugar average and insulin resistance. Cost: Rs.300-600.", 8);
    }
    if (profile.age > 30 || bmi > 25) {
      addBullet(ctx, "Lipid Profile — Cardiovascular risk assessment. Cost: Rs.200-500.", 8);
    }
  }

  addSpacing(ctx, 2);

  if (tier === "premium" || tier === "coaching") {
    addSubSection(ctx, "Advanced Biomarkers (Premium Tier)");
    addBullet(ctx, "Advanced Lipid Profile with ApoB — More accurate cardiovascular predictor. Cost: Rs.800-1,500.", 8);
    addBullet(ctx, "hs-CRP (High-Sensitivity C-Reactive Protein) — Measures systemic inflammation. Cost: Rs.300-600.", 8);
    addBullet(ctx, "Liver Function Tests (SGOT, SGPT, ALP, GGT) — Detects fatty liver. Cost: Rs.300-500.", 8);
    addBullet(ctx, "Kidney Function Tests (Creatinine, BUN, Uric Acid) — Baseline organ health. Cost: Rs.400-700.", 8);
    if (profile.gender === "male" && profile.age > 25) {
      addBullet(ctx, "Free & Total Testosterone — Affects energy, mood, muscle mass. Cost: Rs.500-1,000.", 8);
    }
    addBullet(ctx, "Magnesium (Serum) — Critical for 300+ enzymatic reactions. Cost: Rs.200-400.", 8);
    addSpacing(ctx, 2);
  }

  addSubSection(ctx, "Testing Schedule");
  addBullet(ctx, "Baseline: Get all recommended tests done BEFORE starting your wellness plan (Week 0)", 8);
  addBullet(ctx, "Follow-up: Retest at 12 weeks (90 days) to measure the impact of your lifestyle changes", 8);
  addBullet(ctx, "Maintenance: Annual testing for ongoing health monitoring", 8);
  addSpacing(ctx, 2);
  addNote(ctx, "Estimated total cost for basic panel: Rs.1,500-3,500 | Comprehensive panel: Rs.3,500-6,000. Many labs offer wellness packages at discounted rates. Always fast for 10-12 hours before blood tests.");

  addNewPage(ctx);
}

function renderDigestiveHealth(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile } = bundle;
  if (!profile.digestiveIssues?.length) return;

  addHeaderSection(ctx, "Digestive Health Restoration Plan", `Addressing: ${profile.digestiveIssues.join(", ")}`);

  addText(ctx, "Your gut health directly influences immunity (70% of immune cells are in the gut), mood (95% of serotonin is produced in the gut), and energy levels. Research in Gut (2023) shows gut microbiome diversity is one of the strongest predictors of overall health.", 9);
  addSpacing(ctx, 3);

  addSubSection(ctx, "Gut Healing Protocol (4-Week Plan)");
  addText(ctx, "Week 1-2: Remove & Repair", 9, DARK, true);
  addBullet(ctx, "Reduce processed foods, refined sugar, excess caffeine, and alcohol", 8);
  addBullet(ctx, "Include gut-healing foods: bone broth (or vegetable broth), cooked vegetables, rice congee", 8);
  addBullet(ctx, "Add 1 tbsp ghee to warm rice or dal — ghee contains butyrate which heals gut lining", 8);
  addSpacing(ctx, 2);

  addText(ctx, "Week 3-4: Repopulate & Rebalance", 9, DARK, true);
  addBullet(ctx, "Probiotics: Homemade curd/yogurt daily, or probiotic supplement (50B CFU)", 8);
  addBullet(ctx, "Prebiotics: Banana (slightly green), garlic, onion, oats — feed beneficial bacteria", 8);
  addBullet(ctx, "Fermented foods: Idli, dosa batter, kanji, pickled vegetables (1 serving/day)", 8);
  addSpacing(ctx, 2);

  addSubSection(ctx, "Digestive-Specific Tips");
  profile.digestiveIssues.forEach(issue => {
    const lower = issue.toLowerCase();
    if (lower.includes("bloat")) {
      addBullet(ctx, "For bloating: Eat slowly (20 min per meal), avoid carbonated drinks, try fennel/ajwain water after meals", 8);
    } else if (lower.includes("acid") || lower.includes("reflux")) {
      addBullet(ctx, "For acidity: Don't lie down within 2 hours of eating, avoid spicy foods at dinner, sleep with head slightly elevated", 8);
    } else if (lower.includes("constip")) {
      addBullet(ctx, "For constipation: Increase fiber gradually (25-30g/day), drink warm water on waking, include isabgol (psyllium) husk before bed", 8);
    } else if (lower.includes("ibs") || lower.includes("irritable")) {
      addBullet(ctx, "For IBS: Consider a low-FODMAP elimination diet for 4 weeks, then systematic reintroduction. Consult a gastroenterologist.", 8);
    } else {
      addBullet(ctx, `For ${issue}: Monitor symptoms with a food diary for 2 weeks to identify triggers`, 8);
    }
  });

  addNewPage(ctx);
}

function renderSkinHealth(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile } = bundle;
  if (!profile.skinConcerns?.length) return;

  addHeaderSection(ctx, "Skin Health & Nutrition Guide", `Addressing: ${profile.skinConcerns.join(", ")}`);

  addText(ctx, "Skin is your body's largest organ and reflects internal health. Dermatology research (JAAD, 2023) confirms that nutrition, sleep, stress, and hydration impact skin more than most topical products.", 9);
  addSpacing(ctx, 3);

  addSubSection(ctx, "Nutrition for Skin Health");
  addBullet(ctx, "Vitamin C foods: Amla (Indian gooseberry), bell peppers, citrus, guava — essential for collagen synthesis", 8);
  addBullet(ctx, "Omega-3 fatty acids: Flaxseeds, walnuts, fatty fish — reduce inflammation and improve skin barrier", 8);
  addBullet(ctx, "Zinc-rich foods: Pumpkin seeds, chickpeas, lentils — crucial for wound healing and acne management", 8);
  addBullet(ctx, "Vitamin A: Sweet potato, carrots, spinach — supports skin cell turnover", 8);
  addBullet(ctx, `Hydration: Your target of ${Math.round(profile.weightKg * 0.033 * 10) / 10}L/day is essential for skin plumpness and elasticity`, 8);
  addSpacing(ctx, 2);

  profile.skinConcerns.forEach(concern => {
    const lower = concern.toLowerCase();
    if (lower.includes("acne")) {
      addSubSection(ctx, "Acne Management");
      addBullet(ctx, "Reduce dairy and high-glycemic foods (white bread, sugar) — both shown to increase IGF-1 and worsen acne", 8);
      addBullet(ctx, "Increase zinc intake: 15-30mg/day or zinc-rich foods", 8);
      addBullet(ctx, "Probiotics: Gut health directly influences skin inflammation (gut-skin axis)", 8);
    } else if (lower.includes("dry")) {
      addSubSection(ctx, "Dry Skin Support");
      addBullet(ctx, "Increase omega-3 intake (flaxseed oil, walnuts, fatty fish)", 8);
      addBullet(ctx, "Ensure adequate vitamin E: almonds, sunflower seeds, spinach", 8);
      addBullet(ctx, "Apply coconut/almond oil after bathing while skin is damp", 8);
    } else if (lower.includes("aging") || lower.includes("wrinkle")) {
      addSubSection(ctx, "Anti-Aging Nutrition");
      addBullet(ctx, "Antioxidant-rich foods: berries, green tea, turmeric, dark chocolate (>70% cacao)", 8);
      addBullet(ctx, "Collagen support: vitamin C + glycine-rich foods (bone broth, gelatin)", 8);
      addBullet(ctx, "Sun protection: This is the #1 anti-aging strategy — use SPF 30+ daily", 8);
    }
  });

  addNewPage(ctx);
}

function renderCoachingSection(ctx: PDFContext, bundle: PDFDataBundle): void {
  addHeaderSection(ctx, "Habit Formation & Behavioral Psychology", "The science of making changes stick — exclusive to Coaching Edition");

  addText(ctx, "Research by Phillippa Lally (European Journal of Social Psychology) found that new habits take an average of 66 days to become automatic — not 21 days as commonly believed.", 9);
  addSpacing(ctx, 3);

  addSubSection(ctx, "The Habit Stack Method");
  addText(ctx, "Attach new habits to existing ones for 85% higher success rate:", 9);
  addBullet(ctx, "After I wake up → I drink 500ml water + take vitamin D", 8);
  addBullet(ctx, "After I brush my teeth → I do 5 minutes of stretching", 8);
  addBullet(ctx, "After I sit down for lunch → I take 3 deep breaths before eating", 8);
  addBullet(ctx, "After I change into home clothes → I do my workout", 8);
  addBullet(ctx, "After I get into bed → I journal 3 things I'm grateful for", 8);
  addSpacing(ctx, 3);

  addSubSection(ctx, "The 2-Minute Rule");
  addText(ctx, "When a habit feels overwhelming, scale it down to 2 minutes:", 9);
  addBullet(ctx, "'Exercise for 45 minutes' → 'Put on workout clothes and do 2 minutes'", 8);
  addBullet(ctx, "'Meditate for 15 minutes' → 'Sit quietly and take 3 breaths'", 8);
  addBullet(ctx, "'Cook a healthy meal' → 'Prepare one healthy ingredient'", 8);
  addText(ctx, "Starting is always the hardest part. Once you start, continuing is easy.", 9);
  addSpacing(ctx, 3);

  addSubSection(ctx, "Identity-Based Habits");
  addText(ctx, "Instead of focusing on outcomes, focus on who you want to become:", 9);
  addBullet(ctx, "Not 'I want to lose weight' → 'I am someone who nourishes their body'", 8);
  addBullet(ctx, "Not 'I want to exercise more' → 'I am an active person who moves daily'", 8);
  addBullet(ctx, "Not 'I want to sleep better' → 'I am someone who prioritizes recovery'", 8);
  addNote(ctx, "Ref: James Clear, Atomic Habits — identity change drives lasting behavior change.");

  addNewPage(ctx);

  addHeaderSection(ctx, "Mindset & Accountability Framework", "Your personal coaching structure for 90 days");

  addSubSection(ctx, "Weekly Self-Coaching Questions");
  addText(ctx, "Answer these every Sunday evening (15 min):", 9);
  addBullet(ctx, "What went well this week? (Celebrate wins, no matter how small)", 8);
  addBullet(ctx, "What was my biggest challenge? (Identify, don't judge)", 8);
  addBullet(ctx, "What will I do differently next week? (One specific action)", 8);
  addBullet(ctx, "Am I being consistent, or am I chasing perfection? (Consistency > perfection)", 8);
  addBullet(ctx, "What am I grateful for in my health journey? (Gratitude builds resilience)", 8);
  addSpacing(ctx, 3);

  addSubSection(ctx, "Overcoming Common Obstacles");
  addText(ctx, "'I don't have time'", 9, DARK, true);
  addBullet(ctx, "Reframe: You have the same 24 hours as everyone. It's about priorities, not time.", 8);
  addBullet(ctx, "Solution: Start with 10 minutes. No one is too busy for 10 minutes.", 8);
  addSpacing(ctx, 2);

  addText(ctx, "'I fell off track'", 9, DARK, true);
  addBullet(ctx, "Reframe: Missing one day doesn't erase your progress. Missing two is the start of a new pattern.", 8);
  addBullet(ctx, "Solution: Never miss twice. Get back on track the very next meal/workout.", 8);
  addSpacing(ctx, 2);

  addText(ctx, "'I'm not seeing results'", 9, DARK, true);
  addBullet(ctx, "Reframe: Internal changes (energy, mood, sleep) happen before visible changes.", 8);
  addBullet(ctx, "Solution: Track non-scale victories. Energy, sleep quality, and strength are leading indicators.", 8);

  addNewPage(ctx);

  addHeaderSection(ctx, "Weekly Coaching Worksheet", "Print or copy this template — complete every Sunday");
  addSpacing(ctx, 2);
  addText(ctx, "Week #: ___  |  Date: ___________", 10, DARK, true);
  addSpacing(ctx, 3);
  const worksheetItems = [
    "Sleep: Avg hours ___ | Quality (1-10) ___ | Consistent wake time? Y/N",
    "Nutrition: Meals on plan ___/21 | Water intake ___L/day | Meal timing consistent? Y/N",
    "Exercise: Workouts completed ___/target | Intensity (1-10) ___ | Any pain/discomfort? ___",
    "Stress: Avg stress level (1-10) ___ | Breathwork sessions ___/7 | Nature time this week? Y/N",
    "Energy: Morning (1-10) ___ | Afternoon (1-10) ___ | Evening (1-10) ___",
    "Weight: ___ kg | Waist: ___ cm | How clothes fit: ___",
    "Win of the week: _______________________________________________",
    "Challenge of the week: __________________________________________",
    "One thing to improve next week: ___________________________________",
  ];
  worksheetItems.forEach(item => addText(ctx, item, 9));

  addNewPage(ctx);
}

function renderAddOns(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { addOns, profile } = bundle;
  if (!addOns?.length) return;

  const bmi = profile.bmi || (profile.weightKg / Math.pow(profile.heightCm / 100, 2));
  const bmiCategory = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
  const isVeg = profile.dietaryPreference?.toLowerCase().includes("veg");

  addHeaderSection(ctx, "Premium Analysis Extensions", "Targeted deep-dive protocols based on your selected specialized analysis");

  if (addOns.includes("addon_dna")) {
    addSubSection(ctx, "DNA & Genetics Guide — Understanding Your Genetic Blueprint");
    addText(ctx, `${profile.name}, your genes are the hardware your body runs on. This guide explains the most impactful genetic variants for nutrition & fitness and provides actionable guidance.`, 9);
    addSpacing(ctx, 2);

    addSubSection(ctx, "MTHFR — Methylation & Folate Processing");
    addText(ctx, "The MTHFR gene controls how your body converts folate into its active form. Up to 40% of Indians carry at least one variant that reduces enzyme efficiency by 30-70%.", 9);
    addBullet(ctx, "Dietary action: Increase natural folate — spinach, methi, chickpeas, lentils, beetroot. Aim for 400-600mcg daily.", 8);
    addBullet(ctx, "Supplement: Methylfolate (L-5-MTHF) 400-800mcg/day preferred over synthetic folic acid.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "CYP1A2 — Caffeine Metabolism");
    addText(ctx, "~50% of people are slow caffeine metabolizers, meaning caffeine stays active 2-3x longer.", 9);
    addBullet(ctx, "Fast metabolizers: Can tolerate 3-4 cups/day. Pre-workout coffee may improve performance.", 8);
    addBullet(ctx, "Slow metabolizers: Limit to 1-2 cups before noon. Afternoon caffeine disrupts sleep.", 8);
    addBullet(ctx, `Your sleep score is ${profile.sleepScore}/100 — ${profile.sleepScore < 60 ? "limiting caffeine is especially critical for you" : "maintain caffeine discipline to protect sleep quality"}.`, 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "ACTN3 — Muscle Fiber Composition");
    addBullet(ctx, "RR genotype (power): Higher fast-twitch fibers — excel at sprinting, weightlifting, HIIT.", 8);
    addBullet(ctx, "XX genotype (endurance): Higher slow-twitch fibers — excel at distance running, cycling.", 8);
    addBullet(ctx, "RX genotype (mixed): Can adapt to both power and endurance training.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Recommended Genetic Tests (India)");
    addBullet(ctx, "MapMyGenome 'Genomepatri' — Comprehensive (INR 12,000-18,000)", 8);
    addBullet(ctx, "Xcode Life 'Gene Nutrition' — Nutrition-focused (INR 3,500-5,000)", 8);

    addNewPage(ctx);
  }

  if (addOns.includes("addon_supplement")) {
    addSubSection(ctx, "Advanced Supplement Protocol — 12-Week Periodized Strategy");
    addText(ctx, `${profile.name}, supplements are the final 5-10% of optimization. This protocol is designed around your profile: age ${profile.age}, BMI ${bmi.toFixed(1)} (${bmiCategory}), activity score ${profile.activityScore}/100.`, 9);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Phase 1: Foundation Loading (Weeks 1-4)");
    addBullet(ctx, "Vitamin D3: 60,000 IU once weekly for 8 weeks (loading dose), then 2,000 IU daily.", 8);
    addBullet(ctx, "Vitamin B12 (Methylcobalamin): 1,500mcg daily for 4 weeks (especially critical if vegetarian/vegan).", 8);
    addBullet(ctx, "Magnesium Bisglycinate: 300-400mg at bedtime.", 8);
    addBullet(ctx, "Omega-3 (EPA+DHA): 1,000-2,000mg combined daily.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Phase 2: Targeted Optimization (Weeks 5-8)");
    addBullet(ctx, `Ashwagandha (KSM-66): 300mg twice daily. ${profile.stressScore < 60 ? "Your stress score makes this especially important." : "Supports stress resilience."}`, 8);
    addBullet(ctx, "Probiotics: Multi-strain formula (10-50 billion CFU). Take on empty stomach in the morning.", 8);
    addBullet(ctx, `Zinc: 15-30mg daily with food.`, 8);
    addBullet(ctx, "Curcumin (with Piperine): 500mg daily. Piperine increases absorption by 2,000%.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Phase 3: Maintenance & Cycling (Weeks 9-12)");
    addBullet(ctx, "Continue Vitamin D3 at 2,000 IU daily. Ashwagandha: 5 days on, 2 days off.", 8);
    addBullet(ctx, "Magnesium and Omega-3: Continue daily, no cycling needed.", 8);
    addBullet(ctx, "Probiotics: Rotate strains every 3 months for microbiome diversity.", 8);

    addNewPage(ctx);
  }

  if (addOns.includes("addon_athlete")) {
    addSubSection(ctx, "Athletic Performance Pack — Sport-Specific Optimization");
    addText(ctx, `This section is designed for structured athletic performance. Your current activity score is ${profile.activityScore}/100.`, 9);
    addSpacing(ctx, 2);

    addSubSection(ctx, "12-Week Sport-Specific Training Periodization");
    addBullet(ctx, "Weeks 1-4 (Anatomical Adaptation): Compound lifts at 60-70% 1RM, 3 sets of 12-15 reps.", 8);
    addBullet(ctx, "Weeks 5-8 (Strength & Hypertrophy): 70-85% 1RM, 4 sets of 6-10 reps. Add plyometrics 2x/week.", 8);
    addBullet(ctx, "Weeks 9-11 (Power & Peaking): 85-95% 1RM, 3-5 sets of 1-5 reps. Speed and agility drills.", 8);
    addBullet(ctx, "Week 12 (Active Recovery/Deload): 50% volume and 60% intensity.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Competition Fueling Strategy");
    addBullet(ctx, `Pre-Competition (3-4 hours before): 2-3g carbs per kg. For your weight (${profile.weightKg}kg): ~${Math.round(profile.weightKg * 2.5)}g carbs.`, 8);
    addBullet(ctx, "During Competition (>60 min): 30-60g carbs per hour via sports drink or energy gels.", 8);
    addBullet(ctx, "Post-Competition (within 30 min): 0.3g protein + 1g carbs per kg body weight.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Recovery Protocols");
    addBullet(ctx, "Sleep: 8-9 hours for athletes. Growth hormone peaks during deep sleep.", 8);
    addBullet(ctx, `Nutrition recovery: ${profile.proteinGrams}g protein spread across 4-5 meals/day.`, 8);
    addBullet(ctx, "Active recovery: Low-intensity movement on rest days reduces DOMS by 20-30%.", 8);

    addNewPage(ctx);
  }

  if (addOns.includes("addon_family")) {
    addSubSection(ctx, "Family Wellness Plan — Extending Health to Your Household");
    addText(ctx, `${profile.name}, this guide helps you extend wellness principles to your entire family within Indian dietary culture.`, 9);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Age-Appropriate Nutrition Guidance");
    addText(ctx, "Children (Ages 2-12):", 9, DARK, true);
    addBullet(ctx, "Calories: 1,000-1,800 kcal/day. Never restrict calories in growing children.", 8);
    addBullet(ctx, "Protein: 0.9-1.0g per kg body weight. Sources: milk, curd, paneer, eggs, dal, sprouts.", 8);
    addBullet(ctx, "Critical nutrients: Calcium (500-800mg/day), Iron (8-15mg/day), Vitamin D (400-600 IU/day).", 8);
    addSpacing(ctx, 2);

    addText(ctx, "Teenagers (Ages 13-19):", 9, DARK, true);
    addBullet(ctx, "Calories: 1,800-2,800 kcal/day. Girls during menstruation need extra iron (18mg/day).", 8);
    addBullet(ctx, "Protein: 1.0-1.5g per kg body weight. Critical for growth and brain development.", 8);
    addSpacing(ctx, 2);

    addText(ctx, "Elderly (Ages 55+):", 9, DARK, true);
    addBullet(ctx, "Protein: 1.2-1.5g per kg to prevent sarcopenia. Distribute evenly across meals.", 8);
    addBullet(ctx, "Calcium + Vitamin D: 1,200mg calcium + 2,000 IU daily for bone health.", 8);
    addBullet(ctx, "Key supplements: B12 (1000mcg daily), Omega-3, Probiotics, Curcumin.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Shared Grocery Optimization");
    addBullet(ctx, "Estimated weekly cost: INR 2,500-3,500 for a family of 4.", 8);
    addBullet(ctx, "Buy seasonal produce for maximum nutrition and value.", 8);

    addNewPage(ctx);
  }

  if (addOns.includes("addon_women_hormone")) {
    addSubSection(ctx, "Women's Hormonal Health — Cycle-Synced Wellness");
    addText(ctx, `Female hormones follow a ~28-day cycle that affects energy, metabolism, mood, strength, and recovery.`, 9);
    addSpacing(ctx, 2);

    addText(ctx, "Phase 1: Menstrual Phase (Days 1-5):", 9, DARK, true);
    addBullet(ctx, "Nutrition: Increase iron-rich foods. Anti-inflammatory foods: turmeric milk, ginger tea, omega-3.", 8);
    addBullet(ctx, "Training: Light to moderate. Yoga, walking, stretching.", 8);
    addSpacing(ctx, 2);

    addText(ctx, "Phase 2: Follicular Phase (Days 6-13):", 9, DARK, true);
    addBullet(ctx, "Higher carb tolerance. Increase calories slightly. This is your 'superpower' phase.", 8);
    addBullet(ctx, "Training: Peak performance window — go for personal records.", 8);
    addSpacing(ctx, 2);

    addText(ctx, "Phase 3: Ovulatory Phase (Days 14-16):", 9, DARK, true);
    addBullet(ctx, "Highest energy and confidence. Continue high-intensity training.", 8);
    addSpacing(ctx, 2);

    addText(ctx, "Phase 4: Luteal Phase (Days 17-28):", 9, DARK, true);
    addBullet(ctx, "Metabolic rate increases by 100-300 kcal/day. Increase calories by 100-250 kcal.", 8);
    addBullet(ctx, "Training: Moderate intensity. Focus on steady-state cardio and yoga.", 8);
    addBullet(ctx, "Supplements: Magnesium 400mg, Calcium 500mg, Vitamin B6 50mg for PMS.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "PCOS Insulin-Sensitivity Strategies");
    addBullet(ctx, "Lower glycemic index foods. Replace white rice with millets. 12-hour overnight fast.", 8);
    addBullet(ctx, "Supplements: Inositol (2g Myo + 50mg D-chiro, 2x daily), Berberine 500mg 2x daily.", 8);

    addNewPage(ctx);
  }

  if (addOns.includes("addon_men_fitness")) {
    addSubSection(ctx, "Men's Performance Pack — Muscle Building & Hormonal Optimization");
    addText(ctx, `Designed for men who want to maximize muscle growth and optimize testosterone naturally. Weight: ${profile.weightKg}kg, BMI: ${bmi.toFixed(1)} (${bmiCategory}).`, 9);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Muscle-Building Nutrition Strategy");
    addBullet(ctx, `Caloric surplus: Eat ${profile.tdee + 300}-${profile.tdee + 500} kcal/day for lean muscle gain.`, 8);
    addBullet(ctx, `Protein target: ${Math.round(profile.weightKg * 2.0)}-${Math.round(profile.weightKg * 2.2)}g/day. Distribute across 4-5 meals.`, 8);
    addBullet(ctx, "Pre-sleep protein (casein or paneer) enhances overnight muscle protein synthesis by 22%.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "Testosterone-Supporting Habits");
    addBullet(ctx, "Sleep: 7-9 hours. Men who sleep <5 hours have 10-15% lower testosterone.", 8);
    addBullet(ctx, "Resistance training: Compound lifts (squats, deadlifts, bench) at 70-85% 1RM boost testosterone.", 8);
    addBullet(ctx, "Body fat: Testosterone peaks at 12-18% body fat.", 8);
    addBullet(ctx, "Supplements: Ashwagandha KSM-66 600mg/day, Tongkat Ali 200mg/day, Shilajit 200mg/day.", 8);
    addSpacing(ctx, 2);

    addSubSection(ctx, "12-Week Progressive Overload Program");
    addText(ctx, "Weeks 1-4 (Foundation — 3 days/week):", 9, DARK, true);
    addBullet(ctx, "Push/Pull/Legs split at 60-65% 1RM. Add 2.5-5kg per week.", 8);
    addText(ctx, "Weeks 5-8 (Volume — 4 days/week):", 9, DARK, true);
    addBullet(ctx, "70-80% 1RM. 4 sets on compounds. Introduce drop sets.", 8);
    addText(ctx, "Weeks 9-12 (Intensity — 5 days/week):", 9, DARK, true);
    addBullet(ctx, "75-85% 1RM. Rest-pause sets, supersets, controlled eccentrics. Week 12 deload.", 8);

    addNewPage(ctx);
  }
}

function renderProgressTracking(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, tier } = bundle;

  addHeaderSection(ctx, "90-Day Progress Tracking System", `${profile.name}'s transformation timeline`);

  addSubSection(ctx, "Weekly Check-In (2-3 Minutes Every Sunday)");
  addBullet(ctx, "Energy levels (morning, afternoon, evening): Rate 1-10", 8);
  addBullet(ctx, "Sleep quality and duration: hours + 1-10 rating", 8);
  addBullet(ctx, "Stress level: 1-10 average for the week", 8);
  addBullet(ctx, "Workouts completed: ___/target", 8);
  addBullet(ctx, "Nutrition adherence: ___% on plan", 8);
  addBullet(ctx, "Hydration: Met daily target? Y/N", 8);
  addSpacing(ctx, 3);

  if (tier !== "free") {
    addSubSection(ctx, "Monthly Assessment (Weeks 4, 8, 12)");
    addBullet(ctx, "Body measurements: Weight, waist circumference, hip circumference", 8);
    addBullet(ctx, "Progress photos: Same time, same light, same clothing (front + side)", 8);
    addBullet(ctx, "Performance tests: Push-ups in 1 min, plank hold time, resting heart rate", 8);
    addBullet(ctx, "Blood work: Compare against baseline (if applicable)", 8);
    addBullet(ctx, "Subjective well-being: Mood, confidence, energy consistency", 8);
    addSpacing(ctx, 3);
  }

  addSubSection(ctx, "Expected Timeline");
  addText(ctx, "Week 1-2: Sleep improves, energy begins to stabilize, initial adjustment period", 9);
  addText(ctx, "Week 3-4: Mood elevation, reduced stress, workouts feel easier, digestion improves", 9);
  addText(ctx, "Week 5-8: Visible body composition changes, strength gains, sustained energy throughout the day", 9);
  addText(ctx, "Week 9-12: Major transformation — habits feel automatic, biomarkers improve, confidence increases", 9);
  addSpacing(ctx, 2);
  addNote(ctx, "Individual results vary. Consistency matters more than perfection. Even 80% adherence produces meaningful results over 90 days.");

  addNewPage(ctx);

  addHeaderSection(ctx, "Your 90-Day Action Plan", `${profile.name}'s step-by-step implementation roadmap`);

  addText(ctx, "Phase 1: Foundation (Weeks 1-2)", 10, PURPLE, true);
  addBullet(ctx, "Read this entire blueprint thoroughly — understanding WHY matters", 8);
  addBullet(ctx, "Set consistent wake time and meal times (Action 1 & 2)", 8);
  addBullet(ctx, "Stock kitchen with recommended foods from grocery list", 8);
  addBullet(ctx, "Set up tracking: notebook, spreadsheet, or app (MyFitnessPal, HealthifyMe)", 8);
  if (tier !== "free") {
    addBullet(ctx, "Schedule baseline blood work (recommended tests listed above)", 8);
    addBullet(ctx, "Begin 3x/week movement routine", 8);
  }
  addSpacing(ctx, 3);

  addText(ctx, "Phase 2: Building Momentum (Weeks 3-6)", 10, PURPLE, true);
  addBullet(ctx, "Meal prep: Prepare 2-3 meals in advance on weekends", 8);
  addBullet(ctx, "Add stress management tools: daily breathwork + weekly nature time", 8);
  addBullet(ctx, "Increase workout intensity or frequency by 10-15%", 8);
  addBullet(ctx, "Complete first monthly assessment (Week 4)", 8);
  if (tier === "premium" || tier === "coaching") {
    addBullet(ctx, "Begin supplement stack (one at a time, 2-week intervals)", 8);
  }
  addSpacing(ctx, 3);

  addText(ctx, "Phase 3: Optimization (Weeks 7-12)", 10, PURPLE, true);
  addBullet(ctx, "Adjust calories/macros based on progress and goals", 8);
  addBullet(ctx, "Progressive overload: increase weights, add workout variations", 8);
  addBullet(ctx, "Refine supplement stack based on how you feel", 8);
  addBullet(ctx, "Week 8: Second monthly assessment — compare to baseline", 8);
  addBullet(ctx, "Week 12: Final assessment, blood work recheck, celebrate progress", 8);

  addNewPage(ctx);
}

function renderAdjustments(ctx: PDFContext, bundle: PDFDataBundle): void {
  if (!bundle.adjustments || bundle.adjustments.length === 0) return;
  
  addNewPage(ctx);
  addHeaderSection(ctx, "Automatic Adjustments Made", "Internal corrections applied to ensure blueprint accuracy and safety");
  bundle.adjustments.forEach(adj => addBullet(ctx, adj, 10));
  addSpacing(ctx, 5);
  addNote(ctx, "These adjustments are made automatically by our validation engine to align the recommendations with your physiological profile and dietary constraints.");
}

function renderClosing(ctx: PDFContext, bundle: PDFDataBundle): void {
  const { profile, tier, orderId, timestamp } = bundle;

  ctx.pdf.setFontSize(16);
  ctx.pdf.setTextColor(...PURPLE);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.text("Remember", ctx.margin, ctx.yPosition);
  ctx.yPosition += 10;

  ctx.pdf.setFontSize(11);
  ctx.pdf.setTextColor(...DARK);
  ctx.pdf.setFont("helvetica", "normal");
  const closingLines = ctx.pdf.splitTextToSize(
    `${profile.name}, this blueprint is your evidence-based roadmap to better health. You don't need to be perfect — you need to be consistent. Start with the Top 3 Actions and build from there.\n\nSmall, consistent steps create lasting transformation. You have everything you need to succeed. Trust the process.`,
    ctx.contentWidth
  );
  ctx.pdf.text(closingLines, ctx.margin, ctx.yPosition);
  ctx.yPosition += closingLines.length * 5 + 10;

  if (tier === "coaching") {
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(...PURPLE);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.text("Coaching Edition Exclusive:", ctx.margin, ctx.yPosition);
    ctx.yPosition += 5;
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setTextColor(...DARK);
    const coachingNote = ctx.pdf.splitTextToSize(
      "As a Coaching Edition member, you have access to the weekly coaching worksheets and mindset framework. Use them every Sunday to stay on track and adjust your approach.",
      ctx.contentWidth
    );
    ctx.pdf.text(coachingNote, ctx.margin, ctx.yPosition);
    ctx.yPosition += coachingNote.length * 5 + 6;
  }

  addSpacing(ctx, 8);
  ctx.pdf.setDrawColor(229, 231, 235);
  ctx.pdf.line(ctx.margin, ctx.yPosition, ctx.pageWidth - ctx.margin, ctx.yPosition);
  ctx.yPosition += 6;

  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(...GRAY);
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.text("Disclaimer: This blueprint is for educational purposes and does not constitute medical advice.", ctx.margin, ctx.yPosition);
  ctx.yPosition += 4;
  ctx.pdf.text("Always consult qualified healthcare professionals before making significant lifestyle changes.", ctx.margin, ctx.yPosition);
  ctx.yPosition += 4;
  ctx.pdf.text("Individual results may vary based on adherence, genetics, and pre-existing conditions.", ctx.margin, ctx.yPosition);
  ctx.yPosition += 6;
  ctx.pdf.text(`Generated by GeneWell Wellness Platform | Order: ${orderId} | ${new Date(timestamp).toLocaleDateString("en-IN")}`, ctx.margin, ctx.yPosition);
  ctx.yPosition += 4;
  ctx.pdf.text("© 2026 GeneWell. All rights reserved. | www.genewell.in", ctx.margin, ctx.yPosition);
}

// ══════════════════════════════════════════════════════════════
// COMPOSITION LAYER — NEW PRIMARY ENTRY POINT
// ══════════════════════════════════════════════════════════════

export async function generatePDFFromBundle(rawBundle: PDFDataBundle): Promise<{ blob: Blob; filename: string }> {
  const validation = validatePDFBundle(rawBundle);
  if (validation.adjustments.length > 0) {
    console.log("Auto-adjustments applied:", validation.adjustments);
  }
  const bundle = validation.cleaned;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ctx = createContext(pdf);
  const { tier, rules, addOns, profile } = bundle;
  
  // Filter modules based on gender to ensure clean render tree
  // This is the source of truth for the entire render process
  const activeModules = (rules.activeModules || []).filter(m => {
    if (profile.gender === "male") {
      return !["pcos_protocol", "ovarian_health", "menstrual_cycle", "women_hormone"].includes(m);
    }
    if (profile.gender === "female") {
      return !["prostate_health", "testosterone_optimization", "men_performance"].includes(m);
    }
    return true;
  });

  const sectionOrder: string[] = [
    "top_actions",
    "wellness_baseline",
    "metabolic_profile",
    "nutrition_strategy",
    "meal_plan",
    "sleep_protocol",
    "movement_program",
    "beginner_program",
    "fat_loss_program",
    "muscle_building",
    "stress_management",
    "insulin_management",
    "thyroid_protocol",
    "cardiovascular",
    "gut_health",
    "skin_health",
    "lab_tests",
    "supplements",
    "coaching_edition",
    "progress_tracking"
  ];
  
  // Strictly enforce rendering ONLY from the filtered activeModules array
  sectionOrder.forEach(modId => {
    if (activeModules.includes(modId)) {
      if (modId === "executive_summary") renderTopActions(ctx, bundle);
      if (modId === "metabolic_profile") renderMetabolicProfile(ctx, bundle);
      if (modId === "nutrition_strategy") renderNutritionStrategy(ctx, bundle);
      if (modId === "sleep_protocol") renderSleepProtocol(ctx, bundle);
      if (modId === "movement_program") renderMovementProgram(ctx, bundle);
      if (modId === "beginner_program") renderMovementProgram(ctx, bundle);
      if (modId === "stress_management") renderStressManagement(ctx, bundle);
      if (modId === "insulin_management") renderConditionModules(ctx, bundle);
      if (modId === "thyroid_protocol") renderConditionModules(ctx, bundle);
      if (modId === "cardiovascular") renderConditionModules(ctx, bundle);
      if (modId === "gut_health") renderDigestiveHealth(ctx, bundle);
      if (modId === "skin_health") renderSkinHealth(ctx, bundle);
      if (modId === "lab_tests") renderLabTests(ctx, bundle);
      if (modId === "supplements") renderSupplementStrategy(ctx, bundle);
      if (modId === "meal_plan") renderMealPlan(ctx, bundle);
      if (modId === "coaching_edition") renderCoachingSection(ctx, bundle);
      if (modId === "progress_tracking") renderProgressTracking(ctx, bundle);
    }
  });

  if (addOns?.length > 0) {
    renderAddOns(ctx, bundle);
  }

  renderClosing(ctx, bundle);
  
  if (bundle.adjustments && bundle.adjustments.length > 0) {
    renderAdjustments(ctx, bundle);
  }

  const pdfBlob = pdf.output("blob");
  const sanitizedName = bundle.profile.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  const filename = `${sanitizedName}_${tier}_wellness_blueprint_${bundle.orderId}.pdf`;

  return { blob: pdfBlob, filename };
}

// ══════════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE ADAPTER
// ══════════════════════════════════════════════════════════════

function convertLegacyToBundle(data: PersonalizationData, options: PDFGenerationOptions): PDFDataBundle {
  const { profile, insights } = data;
  const { tier, addOns = [], orderId, timestamp } = options;

  const bmi = profile.estimatedWeightKg / Math.pow(profile.estimatedHeightCm / 100, 2);

  const wellnessProfile: WellnessUserProfile = {
    name: profile.name,
    email: profile.email,
    age: profile.age,
    gender: profile.gender,
    heightCm: profile.estimatedHeightCm,
    weightKg: profile.estimatedWeightKg,
    bmi: parseFloat(bmi.toFixed(1)),
    bmr: profile.estimatedBMR,
    tdee: profile.estimatedTDEE,
    proteinGrams: profile.proteinGrams,
    carbsGrams: profile.carbsGrams,
    fatsGrams: profile.fatsGrams,
    stressScore: profile.stressScore,
    sleepScore: profile.sleepScore,
    activityScore: profile.activityScore,
    energyScore: profile.energyScore,
    medicalConditions: profile.medicalConditions || [],
    digestiveIssues: profile.digestiveIssues || [],
    foodIntolerances: profile.foodIntolerances || [],
    skinConcerns: profile.skinConcerns || [],
    dietaryPreference: profile.dietaryPreference || "non-veg",
    exercisePreference: profile.exercisePreference || [],
    exerciseIntensity: profile.exerciseIntensity || "moderate",
    workSchedule: profile.workSchedule || "9-to-5",
    region: profile.region || "India",
    goals: [],
    recommendedTests: profile.recommendedTests || [],
    supplementPriority: profile.supplementPriority || [],
    mealFrequency: profile.mealFrequency || 3,
    dnaConsent: profile.dnaConsent || false,
  };

  const hasDigestive = profile.digestiveIssues?.length > 0;
  const hasSkin = profile.skinConcerns?.length > 0;
  const hasMedical = profile.medicalConditions?.length > 0;

  const activeModules: string[] = ["top_actions", "wellness_baseline", "sleep", "stress", "progress_tracking"];
  if (tier !== "free") {
    activeModules.push("metabolic_profile", "nutrition", "movement");
  }
  if (hasDigestive && tier !== "free") activeModules.push("gut_health");
  if (hasSkin && (tier === "premium" || tier === "coaching")) activeModules.push("skin_health");
  if (hasMedical) activeModules.push("condition_modules");
  if (tier === "premium" || tier === "coaching") {
    activeModules.push("supplements", "lab_tests");
  }

  const sleepSeverity = profile.sleepScore < 40 ? "severe" as const : profile.sleepScore < 60 ? "moderate" as const : profile.sleepScore < 80 ? "mild" as const : "normal" as const;
  const stressSeverity = profile.stressScore > 70 ? "severe" as const : profile.stressScore > 50 ? "moderate" as const : profile.stressScore > 30 ? "mild" as const : "normal" as const;
  const weightRisk = bmi < 18.5 ? "underweight" as const : bmi < 25 ? "normal" as const : bmi < 30 ? "overweight" as const : "obese" as const;

  const rules: RuleEngineOutput = {
    riskFlags: [],
    activeModules,
    labTestPriority: [],
    narrativeHints: [],
    severityProfile: {
      sleepSeverity,
      stressSeverity,
      weightRisk,
      metabolicRisk: bmi > 30 ? "high" as const : bmi > 25 ? "moderate" as const : "low" as const,
    },
  };

  const conditionNarratives: Record<string, string> = {};
  if (hasMedical) {
    const conditions = profile.medicalConditions.map(c => c.toLowerCase());
    if (conditions.some(c => c.includes("thyroid"))) {
      conditionNarratives["thyroid"] = "Thyroid Support: Prioritize selenium-rich foods (brazil nuts) and iodine (if cleared by doctor). Avoid excessive raw cruciferous vegetables.";
    }
    if (conditions.some(c => c.includes("pcos") || c.includes("ovarian"))) {
      conditionNarratives["pcos"] = "PCOS Management: Focus on low-glycemic index (GI) foods to manage insulin sensitivity. Inositol supplementation may be beneficial.";
    }
    if (conditions.some(c => c.includes("diabetes") || c.includes("sugar"))) {
      conditionNarratives["diabetes"] = "Glycemic Control: Pair all carbohydrates with fiber, protein, and healthy fats to blunt insulin spikes. Post-meal 10-minute walks are mandatory.";
    }
    if (conditions.some(c => c.includes("hypertension") || c.includes("blood pressure"))) {
      conditionNarratives["hypertension"] = `Blood Pressure Management: Reduce sodium to <2,300mg/day, increase potassium-rich foods. Your stress score of ${profile.stressScore}/100 ${profile.stressScore < 60 ? "suggests stress may be contributing." : "is manageable."}`;
    }
    if (conditions.some(c => c.includes("cholesterol") || c.includes("lipid"))) {
      conditionNarratives["cholesterol"] = "Cholesterol Support: Increase soluble fiber (oats, barley, beans), omega-3 fatty acids, and reduce trans fats. Regular aerobic exercise raises HDL.";
    }
  }

  const narratives: NarrativeOutput = {
    executiveSummary: `Dear ${profile.name},\n\nThis wellness blueprint has been created exclusively for you based on your quiz responses, lifestyle patterns, and health goals. Every recommendation is grounded in peer-reviewed research and tailored to your unique profile.\n\nThis is not a generic plan—it reflects YOUR age, body composition, activity level, dietary preferences, stress patterns, and health concerns. Follow the steps consistently for 90 days and track your progress.`,
    riskInterpretation: insights.metabolicInsight,
    goalStrategy: "",
    sleepNarrative: insights.sleepStrategy,
    stressNarrative: insights.stressStrategy,
    nutritionNarrative: `This plan is calculated specifically for a ${profile.age}-year old ${profile.gender} weighing ${profile.estimatedWeightKg}kg. Research in Cell Reports (2022) shows that aligning meals with your circadian rhythm improves insulin sensitivity by up to 36% and reduces inflammation markers.`,
    movementNarrative: insights.workoutStrategy,
    conditionNarratives,
  };

  const scaleFactor = profile.estimatedTDEE / 1800;
  const sc = (base: number) => Math.round(base * scaleFactor / 10) * 10;
  const isVeg = profile.dietaryPreference?.toLowerCase().includes("veg");

  const mealPlan: MealPlanOutput = {
    days: [],
    dailyTargetCalories: profile.estimatedTDEE,
    macroTargets: { protein: profile.proteinGrams, carbs: profile.carbsGrams, fats: profile.fatsGrams },
    dietaryNotes: [`Portion sizes calibrated to your ${profile.estimatedTDEE} kcal target.`],
  };

  if (tier === "premium" || tier === "coaching") {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    dayNames.forEach(dayLabel => {
      const makeMeal = (name: string, cal: number): MealItem => ({
        name,
        calories: sc(cal),
        protein: Math.round(sc(cal) * 0.25 / 4),
        carbs: Math.round(sc(cal) * 0.45 / 4),
        fats: Math.round(sc(cal) * 0.30 / 9),
        portion: "1 serving",
      });

      const day: DayMeal = {
        dayLabel,
        breakfast: [makeMeal(isVeg ? "Masala oat porridge with almonds + banana" : "3 eggs scrambled + whole wheat toast", 350)],
        midMorningSnack: [makeMeal("Roasted makhana + green tea", 120)],
        lunch: [makeMeal(isVeg ? "Rajma curry + brown rice + salad" : "Grilled chicken + brown rice + dal + salad", 550)],
        eveningSnack: [makeMeal("Trail mix (nuts + seeds)", 140)],
        dinner: [makeMeal(isVeg ? "Paneer tikka + roti + palak sabzi" : "Fish curry + roti + steamed vegetables", 500)],
        totalCalories: sc(1660),
        totalProtein: Math.round(profile.proteinGrams),
        totalCarbs: Math.round(profile.carbsGrams),
        totalFats: Math.round(profile.fatsGrams),
      };
      mealPlan.days.push(day);
    });
  }

  return {
    profile: wellnessProfile,
    rules,
    narratives,
    mealPlan,
    tier,
    addOns,
    orderId,
    timestamp,
  };
}

export async function generatePersonalizedPDFClient(
  personalizationData: PersonalizationData,
  options: PDFGenerationOptions
): Promise<{ blob: Blob; filename: string }> {
  const bundle = convertLegacyToBundle(personalizationData, options);
  return generatePDFFromBundle(bundle);
}

// ══════════════════════════════════════════════════════════════
// DOWNLOAD HELPER
// ══════════════════════════════════════════════════════════════

export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
