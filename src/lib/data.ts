/**
 * Seeded operations data. Timestamps are relative to `now` so the console
 * always looks live: one critical incident opened nine minutes ago, a rollout
 * that was rolled back this afternoon, an on-call week in progress.
 *
 * The data is fictional. It exists to exercise the reducer and selectors, not to
 * describe a real company.
 */

import type {
  Deploy, EscalationStep, Incident, OpsData, OnCallShift, Runbook, Roster,
  Service, Severity,
} from "./types.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const at = (now: number, offset: number) => now + offset;

const SERVICES: Service[] = [
  { id: "gateway", name: "Edge gateway", tier: "critical", owner: "Platform" },
  { id: "ledger", name: "Ledger API", tier: "critical", owner: "Payments" },
  { id: "notify", name: "Notifications", tier: "standard", owner: "Platform" },
  { id: "search", name: "Search index", tier: "standard", owner: "Discovery" },
  { id: "console", name: "Admin console", tier: "standard", owner: "Frontend" },
  { id: "jobs", name: "Batch jobs", tier: "standard", owner: "Data" },
];

const ROTATION: Record<string, string[]> = {
  gateway: ["Sagar Thapa", "Priya Gurung", "Bikash Adhikari"],
  ledger: ["Nisha Pradhan", "Bikash Adhikari", "Sabina Rai"],
  notify: ["Priya Gurung", "Rojina Karki", "Anjali Singh"],
  search: ["Arun Bhattarai", "Sabina Rai", "Dipesh Shahi"],
  console: ["Rojina Karki", "Anjali Singh", "Meera Joshi"],
  jobs: ["Bikash Adhikari", "Dipesh Shahi", "Nisha Pradhan"],
};

export const ESCALATION_POLICY: Record<Severity, EscalationStep[]> = {
  SEV1: [
    { afterMinutes: 0, role: "Primary on-call", channel: "page" },
    { afterMinutes: 5, role: "Secondary on-call", channel: "page and phone" },
    { afterMinutes: 15, role: "Engineering manager", channel: "call" },
    { afterMinutes: 30, role: "Incident commander", channel: "bridge" },
  ],
  SEV2: [
    { afterMinutes: 0, role: "Primary on-call", channel: "page" },
    { afterMinutes: 15, role: "Secondary on-call", channel: "page" },
    { afterMinutes: 45, role: "Engineering manager", channel: "call" },
  ],
  SEV3: [
    { afterMinutes: 0, role: "Primary on-call", channel: "ticket" },
    { afterMinutes: 60, role: "Secondary on-call", channel: "page" },
  ],
  SEV4: [{ afterMinutes: 0, role: "Primary on-call", channel: "ticket" }],
};

function startOfWeekUtc(ts: number): number {
  const d = new Date(ts);
  const offset = d.getUTCDay(); // Sunday is 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset);
}

function buildRoster(now: number): Roster {
  const currentWeek = startOfWeekUtc(now);
  const shifts: OnCallShift[] = [];
  for (const service of SERVICES) {
    const names = ROTATION[service.id];
    for (let offset = -1; offset <= 2; offset += 1) {
      const startsAt = currentWeek + offset * WEEK;
      const endsAt = startsAt + WEEK;
      const index = ((offset % names.length) + names.length) % names.length;
      const primary = names[index];
      const secondary = names[(index + 1) % names.length];
      shifts.push({
        id: `${service.id}-primary-${offset}`,
        serviceId: service.id,
        person: primary,
        role: "primary",
        startsAt,
        endsAt,
      });
      shifts.push({
        id: `${service.id}-secondary-${offset}`,
        serviceId: service.id,
        person: secondary,
        role: "secondary",
        startsAt,
        endsAt,
      });
    }
  }
  return { shifts, escalation: ESCALATION_POLICY };
}

function buildIncidents(now: number): Incident[] {
  return [
    {
      id: "INC-4821",
      title: "Checkout latency above 8s on card payments",
      severity: "SEV1",
      status: "mitigating",
      serviceId: "ledger",
      commander: "Nisha Pradhan",
      openedAt: at(now, -9 * MINUTE),
      acknowledgedAt: at(now, -6 * MINUTE),
      resolvedAt: null,
      impact: "Card authorisation calls queue behind a slow database write. About 18 percent of checkout attempts time out.",
      affectedSessions: 2400,
      runbookId: "rb-ledger-latency",
      timeline: [
        { id: "INC-4821-1", at: at(now, -9 * MINUTE), kind: "opened", actor: "Synthetic probe", text: "checkout_probe failed in three regions." },
        { id: "INC-4821-2", at: at(now, -6 * MINUTE), kind: "ack", actor: "Nisha Pradhan", text: "Acknowledged. Pulling database metrics." },
        { id: "INC-4821-3", at: at(now, -5 * MINUTE), kind: "note", actor: "Nisha Pradhan", text: "Write queue at 40k rows, normal is under 2k." },
        { id: "INC-4821-4", at: at(now, -3 * MINUTE), kind: "status", actor: "Nisha Pradhan", text: "Triage to mitigating: two of four replicas drained from the write pool." },
        { id: "INC-4821-5", at: at(now, -1 * MINUTE), kind: "escalation", actor: "Pager", text: "Secondary on-call joined the incident bridge." },
      ],
    },
    {
      id: "INC-4820",
      title: "Search replica is five minutes behind",
      severity: "SEV1",
      status: "triage",
      serviceId: "search",
      commander: "Arun Bhattarai",
      openedAt: at(now, -14 * MINUTE),
      acknowledgedAt: null,
      resolvedAt: null,
      impact: "New listings and edits are missing from search results while replication catches up.",
      affectedSessions: 1800,
      runbookId: "rb-search-replica",
      timeline: [
        { id: "INC-4820-1", at: at(now, -14 * MINUTE), kind: "opened", actor: "Synthetic probe", text: "replication_lag passed 300 seconds." },
        { id: "INC-4820-2", at: at(now, -11 * MINUTE), kind: "note", actor: "Arun Bhattarai", text: "Replica is replaying a large backfill. Waiting one cycle before acting." },
      ],
    },
    {
      id: "INC-4819",
      title: "Notification queue backing up after provider slowdown",
      severity: "SEV2",
      status: "mitigating",
      serviceId: "notify",
      commander: "Priya Gurung",
      openedAt: at(now, -42 * MINUTE),
      acknowledgedAt: at(now, -38 * MINUTE),
      resolvedAt: null,
      impact: "Email and push delivery is delayed by around 25 minutes. No messages are lost.",
      affectedSessions: 3200,
      runbookId: "rb-notify-backlog",
      timeline: [
        { id: "INC-4819-1", at: at(now, -42 * MINUTE), kind: "opened", actor: "Queue monitor", text: "notify.delivery lag passed 15 minutes." },
        { id: "INC-4819-2", at: at(now, -38 * MINUTE), kind: "ack", actor: "Priya Gurung", text: "Acknowledged. Checking the provider status page." },
        { id: "INC-4819-3", at: at(now, -31 * MINUTE), kind: "note", actor: "Priya Gurung", text: "Provider reports degraded API. Our retry budget is absorbing it." },
        { id: "INC-4819-4", at: at(now, -20 * MINUTE), kind: "status", actor: "Priya Gurung", text: "Triage to mitigating: two consumer workers added." },
      ],
    },
    {
      id: "INC-4816",
      title: "Edge gateway 502 spike after v4.2.1 rollout",
      severity: "SEV2",
      status: "resolved",
      serviceId: "gateway",
      commander: "Sagar Thapa",
      openedAt: at(now, -3 * HOUR - 20 * MINUTE),
      acknowledgedAt: at(now, -3 * HOUR - 18 * MINUTE),
      resolvedAt: at(now, -2 * HOUR - 45 * MINUTE),
      impact: "A share of API requests returned 502 for 35 minutes. Static assets were unaffected.",
      affectedSessions: 8600,
      runbookId: "rb-gateway-502",
      timeline: [
        { id: "INC-4816-1", at: at(now, -3 * HOUR - 20 * MINUTE), kind: "opened", actor: "Alert rules", text: "5xx rate above 1 percent for gateway." },
        { id: "INC-4816-2", at: at(now, -3 * HOUR - 18 * MINUTE), kind: "ack", actor: "Sagar Thapa", text: "Acknowledged. Correlating with the edge deploy." },
        { id: "INC-4816-3", at: at(now, -3 * HOUR - 10 * MINUTE), kind: "status", actor: "Sagar Thapa", text: "Triage to mitigating: initiated rollback to v4.2.0." },
        { id: "INC-4816-4", at: at(now, -2 * HOUR - 50 * MINUTE), kind: "deploy", actor: "Deploy bot", text: "Rollback to v4.2.0 finished in 96 seconds." },
        { id: "INC-4816-5", at: at(now, -2 * HOUR - 45 * MINUTE), kind: "status", actor: "Sagar Thapa", text: "Mitigating to resolved: 5xx rate back under 0.05 percent for 30 minutes." },
      ],
    },
    {
      id: "INC-4818",
      title: "Admin console report pages take 12 seconds",
      severity: "SEV3",
      status: "monitoring",
      serviceId: "console",
      commander: "Rojina Karki",
      openedAt: at(now, -65 * MINUTE),
      acknowledgedAt: at(now, -62 * MINUTE),
      resolvedAt: null,
      impact: "Report pages load slowly for internal staff. Customer-facing pages are unaffected.",
      affectedSessions: 240,
      runbookId: "rb-console-slow",
      timeline: [
        { id: "INC-4818-1", at: at(now, -65 * MINUTE), kind: "opened", actor: "Synthetic probe", text: "console_reports p95 above 10 seconds." },
        { id: "INC-4818-2", at: at(now, -62 * MINUTE), kind: "ack", actor: "Rojina Karki", text: "Acknowledged. The report cache is cold after maintenance." },
        { id: "INC-4818-3", at: at(now, -30 * MINUTE), kind: "status", actor: "Rojina Karki", text: "Mitigating to monitoring: cache warmed, p95 now 2.4 seconds." },
      ],
    },
    {
      id: "INC-4815",
      title: "Nightly export job stuck in a retry loop",
      severity: "SEV3",
      status: "resolved",
      serviceId: "jobs",
      commander: "Bikash Adhikari",
      openedAt: at(now, -6 * HOUR),
      acknowledgedAt: at(now, -5 * HOUR - 55 * MINUTE),
      resolvedAt: at(now, -5 * HOUR - 20 * MINUTE),
      impact: "The nightly export ran 40 minutes late. No data was lost.",
      affectedSessions: 0,
      runbookId: "rb-jobs-stuck",
      timeline: [
        { id: "INC-4815-1", at: at(now, -6 * HOUR), kind: "opened", actor: "Job monitor", text: "export_daily exceeded its retry budget." },
        { id: "INC-4815-2", at: at(now, -5 * HOUR - 55 * MINUTE), kind: "ack", actor: "Bikash Adhikari", text: "Acknowledged." },
        { id: "INC-4815-3", at: at(now, -5 * HOUR - 20 * MINUTE), kind: "status", actor: "Bikash Adhikari", text: "Mitigating to resolved: cleared the lock and re-ran the job." },
      ],
    },
    {
      id: "INC-4809",
      title: "Invoice footer shows the wrong support email",
      severity: "SEV4",
      status: "resolved",
      serviceId: "notify",
      commander: "Rojina Karki",
      openedAt: at(now, -28 * HOUR),
      acknowledgedAt: at(now, -27 * HOUR),
      resolvedAt: at(now, -25 * HOUR),
      impact: "A template change shipped an old address. Two customers replied to a monitored mailbox.",
      affectedSessions: 0,
      runbookId: null,
      timeline: [
        { id: "INC-4809-1", at: at(now, -28 * HOUR), kind: "opened", actor: "Support", text: "Ticket from a customer about the invoice footer." },
        { id: "INC-4809-2", at: at(now, -25 * HOUR), kind: "status", actor: "Rojina Karki", text: "Mitigating to resolved: template corrected and redeployed." },
      ],
    },
    {
      id: "INC-4803",
      title: "Ledger read replicas saturated during month-end close",
      severity: "SEV2",
      status: "resolved",
      serviceId: "ledger",
      commander: "Nisha Pradhan",
      openedAt: at(now, -32 * HOUR),
      acknowledgedAt: at(now, -31 * HOUR - 50 * MINUTE),
      resolvedAt: at(now, -30 * HOUR),
      impact: "Read-heavy finance screens were slow for an hour during the close.",
      affectedSessions: 1200,
      runbookId: "rb-db-failover",
      timeline: [
        { id: "INC-4803-1", at: at(now, -32 * HOUR), kind: "opened", actor: "Alert rules", text: "Replica CPU above 90 percent on all four readers." },
        { id: "INC-4803-2", at: at(now, -30 * HOUR), kind: "status", actor: "Nisha Pradhan", text: "Mitigating to resolved: added a fifth reader and capped the close report." },
      ],
    },
    {
      id: "INC-4817",
      title: "Webhook retries failing for two partner endpoints",
      severity: "SEV3",
      status: "triage",
      serviceId: "gateway",
      commander: "Arun Bhattarai",
      openedAt: at(now, -26 * MINUTE),
      acknowledgedAt: null,
      resolvedAt: null,
      impact: "Two partners are receiving duplicate events after a retry storm. No customer data involved.",
      affectedSessions: 40,
      runbookId: "rb-gateway-502",
      timeline: [
        { id: "INC-4817-1", at: at(now, -26 * MINUTE), kind: "opened", actor: "Partner report", text: "Partner reported duplicate webhook deliveries." },
      ],
    },
  ];
}

function buildDeploys(now: number): Deploy[] {
  return [
    {
      id: "DEP-9201",
      serviceId: "ledger",
      version: "v2.14.3",
      environment: "prod",
      status: "in-progress",
      at: at(now, -2 * MINUTE),
      durationSec: 0,
      actor: "Bikash Adhikari",
      commit: "9f3a1c2be41d",
      note: "Rolling out the write-pool change that follows INC-4821.",
      rollbackOf: null,
    },
    {
      id: "DEP-9200",
      serviceId: "console",
      version: "v6.0.2",
      environment: "prod",
      status: "in-progress",
      at: at(now, -6 * MINUTE),
      durationSec: 0,
      actor: "Rojina Karki",
      commit: "3c81d0f7a9b2",
      note: null,
      rollbackOf: null,
    },
    {
      id: "DEP-9199",
      serviceId: "gateway",
      version: "v4.2.0",
      environment: "prod",
      status: "succeeded",
      at: at(now, -2 * HOUR - 50 * MINUTE),
      durationSec: 96,
      actor: "Deploy bot",
      commit: "c07b41e2f8aa",
      note: "Rollback target for the v4.2.1 regression.",
      rollbackOf: "v4.2.1",
    },
    {
      id: "DEP-9198",
      serviceId: "gateway",
      version: "v4.2.1",
      environment: "prod",
      status: "rolled-back",
      at: at(now, -3 * HOUR - 25 * MINUTE),
      durationSec: 74,
      actor: "Sagar Thapa",
      commit: "b12c9d8e4f60",
      note: "5xx rate reached 2.1 percent within four minutes of the shift.",
      rollbackOf: null,
    },
    {
      id: "DEP-9197",
      serviceId: "notify",
      version: "v1.9.0",
      environment: "prod",
      status: "succeeded",
      at: at(now, -55 * MINUTE),
      durationSec: 118,
      actor: "Priya Gurung",
      commit: "77e0a5b3c914",
      note: "Adds the second consumer worker used during INC-4819.",
      rollbackOf: null,
    },
    {
      id: "DEP-9196",
      serviceId: "search",
      version: "v3.3.1",
      environment: "staging",
      status: "succeeded",
      at: at(now, -70 * MINUTE),
      durationSec: 204,
      actor: "Arun Bhattarai",
      commit: "e4d7f2a8b013",
      note: "Replication tuning, not yet promoted.",
      rollbackOf: null,
    },
    {
      id: "DEP-9195",
      serviceId: "jobs",
      version: "v0.9.4",
      environment: "staging",
      status: "failed",
      at: at(now, -5 * HOUR),
      durationSec: 41,
      actor: "Bikash Adhikari",
      commit: "5a1e9c7d2b48",
      note: "Migration timed out on the export table.",
      rollbackOf: null,
    },
    {
      id: "DEP-9194",
      serviceId: "console",
      version: "v6.0.1",
      environment: "prod",
      status: "failed",
      at: at(now, -8 * HOUR),
      durationSec: 63,
      actor: "Rojina Karki",
      commit: "a90b3e6f1c75",
      note: "Health check never turned green. Traffic was never shifted.",
      rollbackOf: null,
    },
    {
      id: "DEP-9193",
      serviceId: "notify",
      version: "v1.8.9",
      environment: "staging",
      status: "succeeded",
      at: at(now, -4 * HOUR),
      durationSec: 88,
      actor: "Priya Gurung",
      commit: "d2f8b4a7e601",
      note: null,
      rollbackOf: null,
    },
    {
      id: "DEP-9192",
      serviceId: "ledger",
      version: "v2.14.2",
      environment: "prod",
      status: "succeeded",
      at: at(now, -26 * HOUR),
      durationSec: 132,
      actor: "Nisha Pradhan",
      commit: "6bc0f9d1a2e3",
      note: "Read replica weights.",
      rollbackOf: null,
    },
    {
      id: "DEP-9191",
      serviceId: "search",
      version: "v3.3.0",
      environment: "prod",
      status: "succeeded",
      at: at(now, -2 * DAY - 3 * HOUR),
      durationSec: 168,
      actor: "Arun Bhattarai",
      commit: "f4a2c8b0d915",
      note: null,
      rollbackOf: null,
    },
    {
      id: "DEP-9190",
      serviceId: "gateway",
      version: "v4.1.9",
      environment: "prod",
      status: "rolled-back",
      at: at(now, -3 * DAY),
      durationSec: 81,
      actor: "Sagar Thapa",
      commit: "0d7e2f5a9c31",
      note: "TLS cipher order regression with two partners.",
      rollbackOf: null,
    },
    {
      id: "DEP-9189",
      serviceId: "ledger",
      version: "v2.14.1",
      environment: "staging",
      status: "succeeded",
      at: at(now, -2 * DAY - 5 * HOUR),
      durationSec: 149,
      actor: "Bikash Adhikari",
      commit: "1a8f6d3b0e77",
      note: null,
      rollbackOf: null,
    },
    {
      id: "DEP-9188",
      serviceId: "jobs",
      version: "v0.9.3",
      environment: "prod",
      status: "succeeded",
      at: at(now, -3 * DAY - 2 * HOUR),
      durationSec: 112,
      actor: "Bikash Adhikari",
      commit: "8e5c1b7a4d29",
      note: null,
      rollbackOf: null,
    },
  ];
}

function buildRunbooks(now: number): Runbook[] {
  return [
    {
      id: "rb-ledger-latency",
      title: "Ledger latency: drain the write queue",
      serviceId: "ledger",
      owner: "Nisha Pradhan",
      tags: ["payments", "database", "latency"],
      steps: [
        "Open the ledger write-queue dashboard and confirm the row count is above 10k.",
        "Check whether the queue depth is growing or draining before changing anything.",
        "Drain two of the four read replicas from the write pool with the CLI script.",
        "Watch p95 authorisation latency for five minutes; it should fall below 800ms.",
        "If the queue keeps growing, disable the batch reconciliation job for thirty minutes.",
        "Post a summary in the incident channel and hand over to the next on-call.",
      ],
      updatedAt: at(now, -12 * DAY),
    },
    {
      id: "rb-gateway-502",
      title: "Gateway 5xx after an edge deploy",
      serviceId: "gateway",
      owner: "Sagar Thapa",
      tags: ["edge", "deploy", "rollback"],
      steps: [
        "Confirm the first 5xx appeared within ten minutes of a deploy in the timeline.",
        "Compare the failing route list with the deploy diff before rolling back.",
        "Run the rollback command; it targets the previous release, not the current one.",
        "Watch the 5xx rate for ten minutes after the shift finishes.",
        "If the rate is still above 0.2 percent, open a SEV1 and page the platform lead.",
      ],
      updatedAt: at(now, -4 * DAY),
    },
    {
      id: "rb-notify-backlog",
      title: "Notification backlog and dead-letter replay",
      serviceId: "notify",
      owner: "Priya Gurung",
      tags: ["queue", "retry", "email"],
      steps: [
        "Check the provider status page first; most backlogs are their incident, not ours.",
        "Confirm the dead-letter queue is not growing faster than the main queue.",
        "Add one consumer worker per 10k queued messages, up to four.",
        "Replay the dead-letter queue only after the provider is healthy again.",
        "Send a test notification to the team list and confirm delivery time.",
      ],
      updatedAt: at(now, -6 * DAY),
    },
    {
      id: "rb-search-replica",
      title: "Search replica lag or replication failure",
      serviceId: "search",
      owner: "Arun Bhattarai",
      tags: ["search", "replication"],
      steps: [
        "Open the replica lag graph and note whether the lag is increasing.",
        "Check the indexer logs for a backfill or a full reindex in progress.",
        "If a backfill is running, pause it and let the replica catch up.",
        "Verify the replica is reading from the primary, not from another replica.",
        "Re-enable the backfill at half the batch size once the lag is under 60 seconds.",
      ],
      updatedAt: at(now, -9 * DAY),
    },
    {
      id: "rb-console-slow",
      title: "Admin console report timeouts",
      serviceId: "console",
      owner: "Rojina Karki",
      tags: ["frontend", "cache", "reports"],
      steps: [
        "Check whether the report cache was invalidated by a deploy or maintenance.",
        "Warm the cache with the report warmer script instead of replaying user requests.",
        "Confirm p95 in the console dashboard falls below three seconds.",
        "If a single report is responsible, disable it for staff and open an incident.",
      ],
      updatedAt: at(now, -20 * DAY),
    },
    {
      id: "rb-jobs-stuck",
      title: "Stuck batch job recovery",
      serviceId: "jobs",
      owner: "Bikash Adhikari",
      tags: ["batch", "retry", "export"],
      steps: [
        "Find the lock holder in the job table; do not clear the lock blindly.",
        "Check whether the worker is alive before marking the job as orphaned.",
        "Clear the lock, then re-run the job with the same idempotency key.",
        "Confirm the output partition count matches yesterday before closing.",
      ],
      updatedAt: at(now, -15 * DAY),
    },
    {
      id: "rb-cert-rotation",
      title: "Rotate the TLS certificate on the edge",
      serviceId: "gateway",
      owner: "Sagar Thapa",
      tags: ["security", "certificate"],
      steps: [
        "Request the certificate through the internal CA and record the serial.",
        "Stage the certificate on one edge node and run the TLS probe against it.",
        "Roll the remaining nodes one at a time, waiting for health checks between nodes.",
        "Revoke the previous certificate after the last node is healthy.",
      ],
      updatedAt: at(now, -33 * DAY),
    },
    {
      id: "rb-db-failover",
      title: "Postgres failover checklist",
      serviceId: "ledger",
      owner: "Nisha Pradhan",
      tags: ["database", "failover", "payments"],
      steps: [
        "Confirm the primary is unreachable from two independent networks.",
        "Promote the replica with the lowest replication lag.",
        "Point the service writer at the new primary and restart the connection pool.",
        "Verify a test write and a test read before re-enabling traffic.",
        "Keep the old primary fenced until it has been rebuilt from a backup.",
        "Record the failover in the incident timeline with the promoted replica id.",
        "Schedule a post-incident review within two working days.",
      ],
      updatedAt: at(now, -40 * DAY),
    },
  ];
}

export function createOpsData(now: number = Date.now()): OpsData {
  return {
    services: SERVICES.map((service) => ({ ...service })),
    incidents: buildIncidents(now),
    deploys: buildDeploys(now),
    roster: buildRoster(now),
    runbooks: buildRunbooks(now),
  };
}
