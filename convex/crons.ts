import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 24/7 background workers
crons.interval("ai health check", { minutes: 30 }, internal.healthAi.checkModels);
crons.interval("data self-repair", { hours: 1 }, internal.health.selfHeal);

export default crons;
