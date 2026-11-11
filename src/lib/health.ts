import type { Health, Risk, Sentiment } from "@/lib/constants";

export type HealthFactor = {
  name: string;
  health: Health;
  detail: string;
};

const RANK: Record<Health, number> = {
  Healthy: 0,
  "Needs attention": 1,
  "At risk": 2,
};

function worst(levels: Health[]): Health {
  return levels.reduce((current, next) => (RANK[next] > RANK[current] ? next : current), "Healthy");
}

export function calculateHealth(input: {
  today: string;
  daysToRenewal: number | null;
  renewalRisk: Risk | null;
  milestones: Array<{ status: string; targetDate: string | null }>;
  latestSentiment: Sentiment | null;
  overdueOpenTasks: number;
}) {
  const timing: HealthFactor =
    input.daysToRenewal === null
      ? { name: "Renewal date", health: "Healthy", detail: "No renewal date" }
      : input.daysToRenewal < 0
        ? { name: "Renewal date", health: "At risk", detail: "Renewal is overdue" }
        : input.daysToRenewal <= 30
          ? { name: "Renewal date", health: "Needs attention", detail: "Renewal is inside 30 days" }
          : { name: "Renewal date", health: "Healthy", detail: "Renewal is outside 30 days" };

  const risk: HealthFactor =
    input.renewalRisk === "High"
      ? { name: "Renewal risk", health: "At risk", detail: "The open renewal is high risk" }
      : input.renewalRisk === "Medium"
        ? { name: "Renewal risk", health: "Needs attention", detail: "The open renewal is medium risk" }
        : input.renewalRisk === "Low"
          ? { name: "Renewal risk", health: "Healthy", detail: "The open renewal is low risk" }
          : { name: "Renewal risk", health: "Healthy", detail: "No open renewal" };

  const blocked = input.milestones.some((milestone) => milestone.status === "Blocked");
  const overduePhase = input.milestones.some(
    (milestone) => milestone.status !== "Done" && milestone.targetDate !== null && milestone.targetDate < input.today,
  );
  const plan: HealthFactor = blocked
    ? { name: "Success plan", health: "At risk", detail: "A phase is blocked" }
    : overduePhase
      ? { name: "Success plan", health: "Needs attention", detail: "A phase is past its target" }
      : { name: "Success plan", health: "Healthy", detail: "No blocked or overdue phases" };

  const meeting: HealthFactor =
    input.latestSentiment === "Concerned"
      ? { name: "Last meeting", health: "Needs attention", detail: "The last meeting was concerned" }
      : input.latestSentiment
        ? { name: "Last meeting", health: "Healthy", detail: `The last meeting was ${input.latestSentiment.toLowerCase()}` }
        : { name: "Last meeting", health: "Healthy", detail: "No past meeting" };

  const tasks: HealthFactor =
    input.overdueOpenTasks > 0
      ? { name: "Tasks", health: "Needs attention", detail: "An open task is overdue" }
      : { name: "Tasks", health: "Healthy", detail: "No overdue tasks" };

  const factors = [timing, risk, plan, meeting, tasks];
  return { health: worst(factors.map((factor) => factor.health)), factors };
}
