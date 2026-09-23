import test from "node:test";
import assert from "node:assert/strict";
import { createOpsData, ESCALATION_POLICY } from "../src/lib/data.ts";
import { INCIDENT_STATUSES, SEVERITIES } from "../src/lib/types.ts";

const NOW = Date.UTC(2026, 10, 20, 14, 32, 0);
const data = createOpsData(NOW);

test("every id is unique inside its collection", () => {
  const unique = (rows: { id: string }[]) => new Set(rows.map((row) => row.id)).size === rows.length;
  assert.ok(unique(data.incidents));
  assert.ok(unique(data.deploys));
  assert.ok(unique(data.runbooks));
  assert.ok(unique(data.roster.shifts));
});

test("incidents reference real services and runbooks, and timelines are ordered", () => {
  const serviceIds = new Set(data.services.map((service) => service.id));
  const runbookIds = new Set(data.runbooks.map((runbook) => runbook.id));
  for (const incident of data.incidents) {
    assert.ok(serviceIds.has(incident.serviceId), incident.id);
    if (incident.runbookId) assert.ok(runbookIds.has(incident.runbookId), incident.id);
    assert.ok(SEVERITIES.includes(incident.severity));
    assert.ok(INCIDENT_STATUSES.includes(incident.status));
    for (let i = 1; i < incident.timeline.length; i += 1) {
      assert.ok(incident.timeline[i - 1]!.at <= incident.timeline[i]!.at, `${incident.id} timeline`);
    }
    if (incident.status === "resolved") {
      assert.ok(incident.resolvedAt !== null, `${incident.id} resolved without a timestamp`);
      assert.ok((incident.resolvedAt ?? 0) >= incident.openedAt);
    } else {
      assert.equal(incident.resolvedAt, null);
    }
  }
});

test("deploys reference services and rollback markers name a known version", () => {
  const serviceIds = new Set(data.services.map((service) => service.id));
  const versions = new Set(data.deploys.map((deploy) => deploy.version));
  for (const deploy of data.deploys) {
    assert.ok(serviceIds.has(deploy.serviceId), deploy.id);
    if (deploy.rollbackOf) assert.ok(versions.has(deploy.rollbackOf), `${deploy.id} rollback target`);
    assert.ok(deploy.commit.length >= 12);
  }
});

test("the roster has a primary and secondary for every service in the current week", () => {
  for (const service of data.services) {
    const current = data.roster.shifts.filter(
      (shift) => shift.serviceId === service.id && shift.startsAt <= NOW && NOW < shift.endsAt,
    );
    assert.equal(current.filter((shift) => shift.role === "primary").length, 1, service.id);
    assert.equal(current.filter((shift) => shift.role === "secondary").length, 1, service.id);
  }
});

test("runbooks have real steps and the escalation policies end with a human", () => {
  for (const runbook of data.runbooks) {
    assert.ok(runbook.steps.length >= 3, runbook.id);
    assert.ok(runbook.tags.length >= 2, runbook.id);
    assert.ok(runbook.steps.every((step) => step.length > 20));
  }
  assert.equal(ESCALATION_POLICY.SEV1.length, 4);
  assert.equal(ESCALATION_POLICY.SEV1.at(-1)?.role, "Incident commander");
  assert.equal(ESCALATION_POLICY.SEV4.length, 1);
  for (const severity of SEVERITIES) {
    const policy = ESCALATION_POLICY[severity];
    for (let i = 1; i < policy.length; i += 1) {
      assert.ok(policy[i - 1]!.afterMinutes < policy[i]!.afterMinutes, severity);
    }
  }
});

test("the data is deterministic for a fixed clock", () => {
  const other = createOpsData(NOW);
  assert.deepEqual(other, data);
  const later = createOpsData(NOW + 60_000);
  assert.notEqual(later.incidents[0]!.openedAt, data.incidents[0]!.openedAt);
});
