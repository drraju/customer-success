export const HEALTH = ["Healthy", "Needs attention", "At risk"] as const;
export const STAGES = ["Onboarding", "Adoption", "Value", "Expansion", "Renewal", "Churned"] as const;
export const PHASES = ["Kickoff", "Onboarding", "Adoption", "Value", "Expansion", "Renewal"] as const;
export const MILESTONE_STATUSES = ["Not started", "In progress", "Blocked", "Done"] as const;
export const RENEWAL_STAGES = [
  "Not started",
  "In progress",
  "Negotiation",
  "Committed",
  "Closed won",
  "Closed lost",
] as const;
export const RISKS = ["Low", "Medium", "High"] as const;
export const FORECASTS = ["Commit", "Best case", "Pipeline", "Omitted"] as const;
export const MEETING_TYPES = ["Check-in", "QBR", "Onboarding", "Renewal", "Executive", "Other"] as const;
export const SENTIMENTS = ["Positive", "Neutral", "Concerned"] as const;
export const WIN_TYPES = ["Adoption", "Expansion", "Executive sponsor", "Reference", "ROI proof", "Other"] as const;
export const IMPACTS = ["High", "Medium", "Low"] as const;
export const TASK_STATUSES = ["Not started", "In progress", "Done"] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const;
export const CONTACT_ROLES = ["Champion", "Executive sponsor", "User", "Billing", "Other"] as const;
export const WINDOWS = ["Overdue", "Next 30 days", "Next 90 days", "Later", "No date"] as const;

export type Health = (typeof HEALTH)[number];
export type Stage = (typeof STAGES)[number];
export type Phase = (typeof PHASES)[number];
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type RenewalStage = (typeof RENEWAL_STAGES)[number];
export type Risk = (typeof RISKS)[number];
export type Forecast = (typeof FORECASTS)[number];
export type MeetingType = (typeof MEETING_TYPES)[number];
export type Sentiment = (typeof SENTIMENTS)[number];
export type WinType = (typeof WIN_TYPES)[number];
export type Impact = (typeof IMPACTS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type ContactRole = (typeof CONTACT_ROLES)[number];
export type RenewalWindow = (typeof WINDOWS)[number];

export function isOneOf<T extends string>(value: string, options: readonly T[]): value is T {
  return (options as readonly string[]).includes(value);
}

export function isClosedRenewal(stage: string) {
  return stage === "Closed won" || stage === "Closed lost";
}
