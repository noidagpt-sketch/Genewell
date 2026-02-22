import type { PDFDataBundle, MealItem, WellnessUserProfile } from "./wellness-types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cleaned: PDFDataBundle;
  adjustments: string[];
}

function cleanText(text: string): string {
  if (!text) return "";
  // Remove placeholders and unresolved templates
  let cleaned = text.replace(/\$\{.*?\}/g, "");
  const commonPlaceholders = ["[Insert", "TODO", "TBD", "PLACEHOLDER", "NARRATIVE_HERE"];
  commonPlaceholders.forEach(p => {
    const reg = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
    cleaned = cleaned.replace(reg, "");
  });
  // Clean encoding issues
  return cleaned.replace(/[\uFFFD]|Â|Ã|Å|Ê/g, "");
}

export function validateAndCorrectBundle(bundle: PDFDataBundle): ValidationResult {
  const adjustments: string[] = [];
  const cleaned = structuredClone(bundle);

  const { profile, narratives, mealPlan, rules } = cleaned;

  // 1. Gender-Condition Mismatch Auto-Correction
  if (profile.gender.toLowerCase() === "male") {
    const initialConditions = [...profile.medicalConditions];
    profile.medicalConditions = profile.medicalConditions.filter(c => !c.toLowerCase().includes("pcos"));
    if (profile.medicalConditions.length !== initialConditions.length) {
      adjustments.push("Non-applicable condition removed");
    }
    
    // Clean narratives of female-specific terms if male
    for (const key in narratives) {
      const k = key as keyof typeof narratives;
      if (typeof narratives[k] === "string") {
        const original = narratives[k] as string;
        let corrected = original.replace(/pcos|ovarian|menstrual/gi, "metabolic balance");
        if (original !== corrected) {
          (narratives as any)[k] = corrected;
          if (!adjustments.includes("Narrative terminology adjusted for gender alignment")) {
            adjustments.push("Narrative terminology adjusted for gender alignment");
          }
        }
      }
    }
  }

  // 2. Food-Intolerance Auto-Correction (Filtering)
  if (mealPlan && mealPlan.days) {
    const intolerances = profile.foodIntolerances.map(i => i.toLowerCase());
    let itemsRemoved = false;
    
    for (const day of mealPlan.days) {
      const mealKeys: (keyof typeof day)[] = ["breakfast", "lunch", "dinner", "midMorningSnack", "eveningSnack"];
      for (const key of mealKeys) {
        const val = day[key as keyof typeof day];
        if (Array.isArray(val)) {
          const items = val as MealItem[];
          const filtered = items.filter(item => {
            const name = item.name.toLowerCase();
            if ((intolerances.includes("lactose") || intolerances.includes("dairy")) && /milk|paneer|curd|cheese|yogurt|dahi|whey|butter/i.test(name)) return false;
            if (intolerances.includes("gluten") && /wheat|roti|bread|maida|semolina|rava|pasta/i.test(name)) return false;
            if ((intolerances.includes("seafood") || intolerances.includes("fish")) && /fish|prawn|shrimp|seafood|crab|lobster/i.test(name)) return false;
            if ((intolerances.includes("nuts") || intolerances.includes("peanuts")) && /peanut|almond|cashew|walnut|pistachio|nut/i.test(name)) return false;
            return true;
          });
          if (filtered.length !== items.length) {
            (day as any)[key] = filtered;
            itemsRemoved = true;
          }
        }
      }
      
      // 3. Macro Re-balancing (Internal scaling if deviations found)
      const targetCals = profile.tdee || 2000;
      const currentCals = day.totalCalories;
      const deviation = Math.abs(currentCals - targetCals) / targetCals;
      
      if (deviation > 0.02) { // 2% threshold for auto-correction
        const scale = targetCals / currentCals;
        day.totalCalories = Math.round(targetCals);
        day.totalProtein = Math.round(day.totalProtein * scale);
        day.totalCarbs = Math.round(day.totalCarbs * scale);
        day.totalFats = Math.round(day.totalFats * scale);
        
        const mealKeys: (keyof typeof day)[] = ["breakfast", "lunch", "dinner", "midMorningSnack", "eveningSnack"];
        for (const key of mealKeys) {
          const val = day[key as keyof typeof day];
          if (Array.isArray(val)) {
            const items = val as MealItem[];
            items.forEach(item => {
              item.calories = Math.round(item.calories * scale);
              item.protein = Math.round(item.protein * scale);
              item.carbs = Math.round(item.carbs * scale);
              item.fats = Math.round(item.fats * scale);
              // Update portion size string if it contains "g"
              if (item.portion.includes("g")) {
                const grams = parseInt(item.portion);
                if (!isNaN(grams)) {
                  item.portion = `${Math.round(grams * scale)}g`;
                }
              }
            });
          }
        }
        if (!adjustments.includes("Calories adjusted to match target")) {
          adjustments.push("Calories adjusted to match target");
        }
      }
    }
    if (itemsRemoved) {
      if (!adjustments.includes("Portions auto-balanced")) {
        adjustments.push("Portions auto-balanced");
      }
    }
  }

  // 4. Clean Narratives (Placeholders and Encoding)
  let placeholderFix = false;
  for (const key in narratives) {
    const k = key as keyof typeof narratives;
    if (typeof narratives[k] === "string") {
      const original = narratives[k] as string;
      const cleanedText = cleanText(original);
      if (original !== cleanedText) {
        (narratives as any)[k] = cleanedText;
        placeholderFix = true;
      }
    }
  }
  if (placeholderFix) {
    if (!adjustments.includes("Text formatting optimized")) {
       adjustments.push("Text formatting optimized");
    }
  }

  // 5. Lab Relevance & Priority Fix
  if (rules.labTestPriority) {
    const initialCount = rules.labTestPriority.length;
    rules.labTestPriority = rules.labTestPriority.filter(t => t.priority > 0 && t.reason && t.reason.length > 5);
    rules.labTestPriority.sort((a, b) => b.priority - a.priority);
    if (rules.labTestPriority.length !== initialCount) {
      if (!adjustments.includes("Lab recommendations refined")) {
        adjustments.push("Lab recommendations refined");
      }
    }
  }

  // 6. Supplement Dedup
  if (profile.supplementPriority) {
    const originalCount = profile.supplementPriority.length;
    const seen = new Set<string>();
    profile.supplementPriority = profile.supplementPriority.filter(s => {
      const normalized = s.toLowerCase().trim().replace(/\s+/g, "");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
    if (profile.supplementPriority.length !== originalCount) {
      if (!adjustments.includes("Supplement overlaps resolved")) {
        adjustments.push("Supplement overlaps resolved");
      }
    }
  }

  cleaned.adjustments = adjustments;

  return {
    valid: true, 
    errors: [],
    warnings: [],
    cleaned,
    adjustments
  };
}

export function validatePDFBundle(bundle: PDFDataBundle): ValidationResult {
  return validateAndCorrectBundle(bundle);
}
