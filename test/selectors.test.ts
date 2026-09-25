import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reducer } from "../src/lib/state.ts";
import type { AppState } from "../src/lib/state.ts";
import type { Deploy } from "../src/lib/types.ts";
import {
  deployStats, selectActiveEscalations, selectCurrentOnCall, selectDeployFeed,
  selectDeployStats, selectEscalationHint, selectHandoffs, selectKpis,
  selectRunbookMatches, selectSelectedRunbook, selectServiceStatus, selectTagCounts,
  selectVisibleIncidents,
} from "../src/lib/selectors.ts";

const NOW = Date.UTC(2026, 10, 20, 14, 32, 0);

function state(): AppState {
  return createInitialState(NOW);
}

test("visible incidents default to open, sorted by severity then age", () => {
  const rows = selectVisibleIncidents(state());
  assert.deepEqual(rows.map((row) => row.id), ["INC-4820", "INC-4821", "INC-4819", "INC-4817", "INC-4818"]);
  assert.ok(rows.every((row) => row.status !== "resolved"));
});

test("incident filters apply severity, status and free text", () => {
  const base = state();
  const sev1 = reducer(base, { type: "setFilters", patch: { severity: "SEV1" } });
  assert.deepEqual(selectVisibleIncidents(sev1).map((row) => row.id), ["INC-4820", "INC-4821"]);

  const all = reducer(base, { type: "setFilters", patch: { status: "all" } });
  assert.equal(selectVisibleIncidents(all).length, 9);

  const search = reducer(base, { type: "setFilters", patch: { status: "all", query: "gateway" } });
  assert.deepEqual(selectVisibleIncidents(search).map((row) => row.id), ["INC-4816", "INC-4817"]);

  const noMatch = reducer(base, { type: "setFilters", patch: { query: "nothing-matches" } });
  assert.deepEqual(selectVisibleIncidents(noMatch), []);
});

test("KPIs count open, unacknowledged and deploy health for the last day", () => {
  const kpis = selectKpis(state());
  assert.equal(kpis.openIncidents, 5);
  assert.equal(kpis.sev1Open, 2);
  assert.equal(kpis.unacknowledged, 2);
  assert.equal(kpis.onCallCovered, 6);
  assert.equal(kpis.servicesTotal, 6);
  assert.equal(kpis.deploys24h, 6);
  assert.equal(kpis.rollbacks24h, 1);
  assert.equal(kpis.deploySuccessRate, 0.5);
  // Resolved incidents took 35m, 40m, 180m and 120m from open to resolve.
  assert.equal(kpis.mttrMinutes, 93.75);
});

test("deployStats ignores in-progress rows and takes the median duration", () => {
  const row = (id: string, status: Deploy["status"], durationSec: number): Deploy => ({
    id,
    serviceId: "gateway",
    version: `v1.0.${id}`,
    environment: "prod",
    status,
    at: NOW,
    durationSec,
    actor: "Deploy bot",
    commit: "0123456789ab",
    note: null,
    rollbackOf: null,
  });
  const deploys = [
    row("1", "succeeded", 96),
    row("2", "failed", 63),
    row("3", "rolled-back", 74),
    row("4", "succeeded", 118),
    row("5", "in-progress", 0),
  ];
  const stats = deployStats(deploys);
  assert.equal(stats.total, 5);
  assert.equal(stats.finished, 4);
  assert.equal(stats.inProgress, 1);
  assert.equal(stats.successRate, 0.5);
  assert.equal(stats.medianDurationSec, 85);
  assert.equal(selectDeployStats(state()).successRate, 0.5);
});

test("deploy feed respects the environment filter and newest-first order", () => {
  const base = state();
  const prod = selectDeployFeed(base);
  assert.ok(prod.every((deploy) => deploy.environment === "prod"));
  for (let i = 1; i < prod.length; i += 1) {
    assert.ok(prod[i - 1]!.at >= prod[i]!.at);
  }
  const staging = selectDeployFeed(reducer(base, { type: "setFilters", patch: { environment: "staging" } }));
  assert.ok(staging.length > 0);
  assert.ok(staging.every((deploy) => deploy.environment === "staging"));
});

test("current on-call covers every service and handoffs start at the week boundary", () => {
  const rows = selectCurrentOnCall(state());
  assert.equal(rows.length, 6);
  assert.ok(rows.every((row) => row.primary && row.secondary));
  assert.ok(rows.every((row) => row.endsAt === Date.UTC(2026, 10, 22)));

  const handoffs = selectHandoffs(state());
  assert.equal(handoffs.length, 5);
  assert.ok(handoffs.every((row) => row.startsAt > NOW));
  assert.ok(handoffs.every((row) => row.startsAt === Date.UTC(2026, 10, 22)));
});

test("escalation hints follow the severity policy clock", () => {
  const base = state();
  const sev1 = base.incidents.find((row) => row.id === "INC-4821");
  assert.ok(sev1);
  const hint = selectEscalationHint(base, sev1);
  assert.equal(hint.minutesOpen, 9);
  assert.equal(hint.current.role, "Secondary on-call");
  assert.equal(hint.next?.role, "Engineering manager");
  assert.equal(hint.nextAt, sev1.openedAt + 15 * 60_000);
  assert.equal(hint.steps.length, 4);

  const escalations = selectActiveEscalations(base);
  assert.equal(escalations.length, 3); // two SEV1 and one SEV2, all active
  assert.deepEqual(escalations.map((row) => row.incident.id), ["INC-4820", "INC-4821", "INC-4819"]);
});

test("runbook search ranks title and tag hits above step text", () => {
  const base = state();
  const rollback = selectRunbookMatches(reducer(base, { type: "setRunbookQuery", query: "rollback" }));
  assert.equal(rollback[0]?.runbook.id, "rb-gateway-502");
  assert.ok(rollback[0]!.matched.includes("title") || rollback[0]!.matched.includes("tag"));

  const all = selectRunbookMatches(base);
  assert.equal(all.length, 8);
  assert.ok(all.every((row) => row.score === 0));

  const tagged = reducer(base, { type: "setRunbookQuery", query: "database" });
  const matches = selectRunbookMatches(tagged);
  assert.ok(matches.length >= 2);
  assert.ok(matches.every((row) => row.score > 0));
});

test("runbook selection falls back to the best match, and tags are counted", () => {
  const base = state();
  assert.equal(selectSelectedRunbook(base)?.id, base.selectedRunbookId);
  const cleared = reducer(base, { type: "selectRunbook", id: null });
  // With nothing selected, the most recently updated runbook is shown.
  assert.equal(selectSelectedRunbook(cleared)?.id, "rb-gateway-502");

  const tags = selectTagCounts(base.runbooks);
  assert.equal(tags.find((row) => row.tag === "payments")?.count, 2);
});

test("service status combines incidents, deploys and on-call", () => {
  const rows = selectServiceStatus(state());
  assert.equal(rows.length, 6);
  const gateway = rows.find((row) => row.service.id === "gateway");
  assert.ok(gateway);
  assert.equal(gateway.openIncidents, 1);
  assert.equal(gateway.worstSeverity, "SEV3");
  assert.equal(gateway.lastDeploy?.version, "v4.2.0");
  assert.ok(gateway.onCall);

  const ledger = rows.find((row) => row.service.id === "ledger");
  assert.equal(ledger?.openIncidents, 1);
  assert.equal(ledger?.worstSeverity, "SEV1");
});

test("an empty console still returns sane null-safe values", () => {
  const base = state();
  const empty: AppState = { ...base, incidents: [], deploys: [] };
  const kpis = selectKpis(empty);
  assert.equal(kpis.openIncidents, 0);
  assert.equal(kpis.mttrMinutes, null);
  assert.equal(kpis.deploySuccessRate, null);
  assert.deepEqual(selectVisibleIncidents(empty), []);
  assert.deepEqual(selectServiceStatus(empty).map((row) => row.lastDeploy), [null, null, null, null, null, null]);
});
