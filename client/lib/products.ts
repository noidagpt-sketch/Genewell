export const PLAN_IDS = {
  FREE: "free_blueprint",
  ESSENTIAL: "essential_blueprint",
  PREMIUM: "premium_blueprint",
  COACHING: "coaching_blueprint",
} as const;

export const ADDON_IDS = {
  DNA: "addon_dna",
  SUPPLEMENT: "addon_supplement",
  ATHLETE: "addon_athlete",
  FAMILY: "addon_family",
  WOMEN_HORMONE: "addon_women_hormone",
  MEN_FITNESS: "addon_men_fitness",
} as const;

export interface Product {
  id: string;
  planId?: string;
  name: string;
  description: string;
  details: string[];
  price: number;
  originalPrice?: number;
  color: string;
  icon: string;
  link: string;
  pageCount: number;
  pdfContent?: string;
  badge?: string;
  popular?: boolean;
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  features: string[];
  pageCountAddition: number;
}

export interface PlanConfiguration {
  planId: string;
  selectedAddOns: string[];
  totalPrice: number;
  userName?: string;
  userEmail?: string;
}

export const FREE_BLUEPRINT: Product = {
  id: "free-blueprint",
  planId: PLAN_IDS.FREE,
  name: "Starter Blueprint",
  description: "Your personalized wellness foundation — sleep assessment, stress evaluation, top 5 daily habits, hydration protocol, and a 90-day quick-start checklist. Science-backed and tailored to your quiz answers.",
  details: [
    "Personalized sleep & circadian rhythm assessment",
    "Stress resilience score with actionable tools",
    "Top 5 daily habit recommendations",
    "Evidence-based hydration & movement guidelines",
    "90-day quick-start action checklist",
    "Recommended lab tests with Indian lab pricing",
  ],
  price: 0,
  color: "gray",
  icon: "gift",
  link: "/quiz",
  pageCount: 8,
  badge: "Free Forever",
};

export const ESSENTIAL_BLUEPRINT: Product = {
  id: "essential-blueprint",
  planId: PLAN_IDS.ESSENTIAL,
  name: "Essential Blueprint",
  description: "Complete nutrition + fitness foundation. Personalized meal timing based on your circadian rhythm, macro targets calculated for your body, a structured 3-day training program, and weekly accountability tracker.",
  price: 499,
  originalPrice: 999,
  color: "blue",
  icon: "star",
  link: "/quiz",
  pageCount: 14,
  badge: "50% Off Launch",
  details: [
    "Everything in Starter Blueprint",
    "Metabolic profile: BMR, TDEE, body composition analysis",
    "Personalized macronutrient targets (protein/carbs/fats)",
    "Circadian-optimized meal timing framework",
    "3-day structured training program (beginner-friendly)",
    "Progressive overload guide for strength gains",
    "Advanced stress management & sleep supplements",
    "Diet-specific recommendations (veg/non-veg/vegan)",
    "Food intolerance substitution guide",
  ],
};

export const PREMIUM_BLUEPRINT: Product = {
  id: "premium-blueprint",
  planId: PLAN_IDS.PREMIUM,
  name: "Premium Blueprint",
  description: "The complete wellness transformation package. Full 7-day Indian meal plan with recipes, grocery shopping list, 5-day advanced training, supplement stack with timing, digestive & skin health protocols, and recommended lab tests.",
  price: 999,
  originalPrice: 2499,
  color: "green",
  icon: "zap",
  link: "/quiz",
  pageCount: 22,
  badge: "Best Value",
  popular: true,
  details: [
    "Everything in Essential Blueprint",
    "Complete 7-day meal plan (veg & non-veg options)",
    "Indian grocery shopping list with estimated costs",
    "5-day periodized training program with exercises",
    "Digestive health restoration protocol (4-week plan)",
    "Skin health & nutrition guide for your concerns",
    "Evidence-based supplement stack with timing protocol",
    "Recommended lab tests & biomarker tracking",
    "Calorie targets for weight loss, maintenance & muscle gain",
    "Hydration protocol personalized to your body weight",
  ],
};

export const COMPLETE_COACHING: Product = {
  id: "complete-coaching",
  planId: PLAN_IDS.COACHING,
  name: "Coaching Edition",
  description: "Premium Blueprint + exclusive coaching content. Habit formation psychology, mindset & accountability framework, weekly self-coaching worksheets, and advanced stress resilience techniques. Built for lasting transformation.",
  price: 2999,
  originalPrice: 9999,
  color: "orange",
  icon: "heart",
  link: "/quiz",
  pageCount: 30,
  badge: "70% Off Launch",
  details: [
    "Everything in Premium Blueprint",
    "6-day periodized training (12-week program)",
    "Habit formation science & habit stacking method",
    "Identity-based habit change framework",
    "Mindset & accountability coaching structure",
    "Weekly self-coaching worksheet (printable)",
    "Advanced stress resilience (cold exposure, NSDR, journaling)",
    "Overcoming obstacles playbook (time, motivation, plateaus)",
    "90-day transformation timeline with milestones",
    "Priority email support for questions",
  ],
};

export const products: Product[] = [
  FREE_BLUEPRINT,
  ESSENTIAL_BLUEPRINT,
  PREMIUM_BLUEPRINT,
  COMPLETE_COACHING,
];

export const getProductById = (id: string): Product | undefined => {
  return products.find((p) => p.id === id);
};

export const getProductByPlanId = (planId: string): Product | undefined => {
  return products.find((p) => p.planId === planId);
};

export const addOns: AddOn[] = [
  {
    id: ADDON_IDS.DNA,
    name: "DNA & Genetics Guide",
    description: "Understand how your genes affect nutrition, caffeine metabolism, and exercise response",
    price: 999,
    icon: "dna",
    pageCountAddition: 3,
    features: [
      "MTHFR methylation status (folate processing)",
      "CYP1A2 caffeine metabolism (fast vs. slow)",
      "ACTN3 muscle fiber type (power vs. endurance)",
      "Gene limitations explained honestly",
      "Practical training & nutrition modifications",
      "Gene-specific lab test recommendations",
    ],
  },
  {
    id: ADDON_IDS.SUPPLEMENT,
    name: "Advanced Supplement Protocol",
    description: "12-week periodized supplement strategy with brand recommendations and lab-based dosing",
    price: 1499,
    icon: "pill",
    pageCountAddition: 3,
    features: [
      "Deficiency testing interpretation guide",
      "12-week periodized supplement protocol",
      "Trusted Indian brand recommendations",
      "Timing & stacking strategy",
      "Loading, maintenance & deload phases",
      "Lab tests to determine necessity",
    ],
  },
  {
    id: ADDON_IDS.ATHLETE,
    name: "Athletic Performance Pack",
    description: "Sport-specific training, energy systems, and competition fueling strategy",
    price: 1299,
    icon: "target",
    pageCountAddition: 2,
    features: [
      "Sport-specific 12-week periodization",
      "Energy system training (aerobic, lactate, alactic)",
      "Competition fueling strategy",
      "Post-competition recovery protocols",
      "Performance metrics (HRV, VO2max, time trials)",
      "Advanced lab testing for athletes",
    ],
  },
  {
    id: ADDON_IDS.FAMILY,
    name: "Family Wellness Plan",
    description: "Extend your blueprint to up to 4 family members with personalized adjustments",
    price: 1999,
    icon: "users",
    pageCountAddition: 4,
    features: [
      "Up to 4 family member profiles",
      "Individual meal timing frameworks",
      "Family-friendly Indian recipes",
      "Grocery list optimized for household",
      "Age-appropriate nutrition guidance",
      "Shared vs. individual lab tests",
    ],
  },
  {
    id: ADDON_IDS.WOMEN_HORMONE,
    name: "Women's Hormonal Health",
    description: "Cycle-synced nutrition, PCOS support, and hormone-aware training protocols",
    price: 799,
    icon: "heart",
    pageCountAddition: 2,
    features: [
      "Menstrual cycle-synced nutrition (follicular/luteal)",
      "PCOS insulin-sensitivity strategies",
      "Thyroid-supporting nutrition protocols",
      "Training adjustments by cycle phase",
      "Hormonal health explained simply",
      "Priority hormone lab tests (TSH, LH/FSH, prolactin)",
    ],
  },
  {
    id: ADDON_IDS.MEN_FITNESS,
    name: "Men's Performance Pack",
    description: "Muscle-building framework, testosterone support, and advanced strength programming",
    price: 799,
    icon: "zap",
    pageCountAddition: 2,
    features: [
      "Muscle-building nutrition (surplus, protein timing)",
      "Testosterone-supporting habits & training",
      "12-week progressive overload programming",
      "Plateau-breaking strategies",
      "Recovery & strength progression",
      "Relevant lab tests (lipid, glucose, testosterone)",
    ],
  },
];

export const getAddOnById = (id: string): AddOn | undefined => {
  return addOns.find((ao) => ao.id === id);
};
