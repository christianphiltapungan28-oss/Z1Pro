import type { LifeMetricKey } from "@/db/schema";

// The seven life areas shown on the Profile page, in the design's order.
// Shared by the server (AI prompt) and the Profile page.

export const LIFE_AREAS: { key: LifeMetricKey; name: string; icon: string; covers: string }[] = [
  { key: "purpose", name: "Purpose", icon: "profile/target", covers: "meaning, direction, career and long-term goals" },
  { key: "finances", name: "Finances", icon: "profile/wallet", covers: "money, budgeting, debt, income and spending" },
  { key: "family", name: "Family", icon: "profile/heart-handshake", covers: "parents, siblings, partner, children and home life" },
  { key: "health", name: "Health", icon: "profile/shield-check", covers: "sleep, energy, exercise, stress and wellbeing" },
  { key: "growth", name: "Personal Growth", icon: "profile/mountain", covers: "learning, habits, skills and self-reflection" },
  { key: "faith", name: "Faith", icon: "profile/circle-x", covers: "spirituality, beliefs, values and inner peace" },
  { key: "community", name: "Community", icon: "profile/hand-helping", covers: "friends, social life, volunteering and belonging" },
];
