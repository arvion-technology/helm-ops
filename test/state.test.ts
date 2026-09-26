import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, nextStatus, reducer } from "../src/lib/state.ts";
import type { AppState, Action } from "../src/lib/state.ts";

const NOW = Date.UTC(2026, 10, 20, 14, 32, 0);

function state(): AppState {
  return createInitialState(NOW);
}

function apply(base: AppState, ...actions: Action[]): AppState {
  return actions.reduce((current, action) => reducer(current, action), base);
}

test("initial state opens on the highest severity active incident", () => {
  const initial = state();
  assert.equal(initial.tab, "incidents");
  assert.equal(initial.filters.status, "active");
  assert.equal(initial.history.length, 0);
  assert.equal(initial.incidents.length, 9);
  assert.equal(initial.selectedIncidentId, "INC-4820");
  assert.ok(initial.selectedRunbookId);
});

test("acknowledging records the time, appends a timeline entry and is undoable", () => {
  const initial = state();
  const incident = initial.incidents.find((row) => row.id === "INC-4820");
  assert.ok(incident);
  assert.equal(incident.acknowledgedAt, null);

  const next = apply(initial, { type: "acknowledge", id: "INC-4820", at: NOW });
  const updated = next.incidents.find((row) => row.id === "INC-4820");
  assert.equal(updated?.acknowledgedAt, NOW);
  assert.equal(updated?.timeline.length, incident.timeline.length + 1);
  assert.equal(updated?.timeline.at(-1)?.kind, "ack");
  assert.equal(next.history[0]?.label, "acknowledged INC-4820");

  const undone = reducer(next, { type: "undo" });
  assert.equal(undone.incidents.find((row) => row.id === "INC-4820")?.acknowledgedAt, null);
  assert.equal(undone.history.length, 0);
});

test("acknowledging twice or acknowledging a resolved incident is a no-op", () => {
  const acked = apply(state(), { type: "acknowledge", id: "INC-4821", at: NOW });
  const again = reducer(acked, { type: "acknowledge", id: "INC-4821", at: NOW + 1 });
  assert.equal(again, acked);

  const resolved = state().incidents.find((row) => row.id === "INC-4816");
  assert.ok(resolved);
  assert.equal(resolved.status, "resolved");
  const attempt = reducer(state(), { type: "acknowledge", id: "INC-4816", at: NOW });
  assert.equal(attempt.history.length, 0);
});

test("advance walks the status ladder and sets resolvedAt at the end", () => {
  const initial = state();
  assert.equal(nextStatus("triage"), "mitigating");
  assert.equal(nextStatus("mitigating"), "monitoring");
  assert.equal(nextStatus("monitoring"), "resolved");
  assert.equal(nextStatus("resolved"), null);

  const first = apply(initial, { type: "advance", id: "INC-4820", at: NOW });
  assert.equal(first.incidents.find((row) => row.id === "INC-4820")?.status, "mitigating");
  const second = apply(first, { type: "advance", id: "INC-4820", at: NOW + 1000 });
  assert.equal(second.incidents.find((row) => row.id === "INC-4820")?.status, "monitoring");
  const third = apply(second, { type: "advance", id: "INC-4820", at: NOW + 2000 });
  const closed = third.incidents.find((row) => row.id === "INC-4820");
  assert.equal(closed?.status, "resolved");
  assert.equal(closed?.resolvedAt, NOW + 2000);
  assert.equal(closed?.timeline.at(-1)?.text, "monitoring to resolved.");
  assert.equal(third.history.length, 3);

  const fourth = apply(third, { type: "advance", id: "INC-4820", at: NOW + 3000 });
  assert.equal(fourth, third);
});

test("undo only reverses status changes and returns to the previous incident set", () => {
  const initial = state();
  const advanced = apply(initial,
    { type: "acknowledge", id: "INC-4820", at: NOW },
    { type: "advance", id: "INC-4820", at: NOW + 1000 },
  );
  assert.equal(advanced.history.length, 2);

  const once = reducer(advanced, { type: "undo" });
  assert.equal(once.incidents.find((row) => row.id === "INC-4820")?.status, "triage");
  assert.equal(once.incidents.find((row) => row.id === "INC-4820")?.acknowledgedAt, NOW);

  const twice = reducer(once, { type: "undo" });
  assert.deepEqual(twice.incidents, initial.incidents);
  assert.equal(reducer(twice, { type: "undo" }), twice);
});

test("notes are appended without entering the undo history", () => {
  const initial = state();
  const noted = reducer(initial, { type: "logNote", id: "INC-4821", text: "  Rolling back the write pool.  ", at: NOW });
  const incident = noted.incidents.find((row) => row.id === "INC-4821");
  assert.equal(incident?.timeline.at(-1)?.kind, "note");
  assert.equal(incident?.timeline.at(-1)?.text, "Rolling back the write pool.");
  assert.equal(incident?.timeline.at(-1)?.actor, "You");
  assert.equal(noted.history.length, 0);

  assert.equal(reducer(initial, { type: "logNote", id: "INC-4821", text: "   " }), initial);
});

test("filters merge, tabs validate, and selection actions are typed", () => {
  const initial = state();
  const filtered = apply(initial,
    { type: "setFilters", patch: { severity: "SEV1" } },
    { type: "setFilters", patch: { query: "ledger" } },
  );
  assert.deepEqual(filtered.filters, {
    severity: "SEV1", status: "active", query: "ledger", environment: "prod",
  });

  const onDeploys = reducer(initial, { type: "setTab", tab: "deploys" });
  assert.equal(onDeploys.tab, "deploys");
  assert.equal(reducer(onDeploys, { type: "setTab", tab: "deploys" }), onDeploys);

  assert.equal(reducer(initial, { type: "selectIncident", id: "INC-4819" }).selectedIncidentId, "INC-4819");
  assert.equal(reducer(initial, { type: "selectRunbook", id: "rb-db-failover" }).selectedRunbookId, "rb-db-failover");
  assert.equal(reducer(initial, { type: "setRunbookQuery", query: "rollback" }).runbookQuery, "rollback");
});

test("the clock action updates now without touching the incident data", () => {
  const initial = state();
  const ticked = reducer(initial, { type: "setNow", now: NOW + 30_000 });
  assert.equal(ticked.now, NOW + 30_000);
  assert.equal(ticked.incidents, initial.incidents);
  assert.equal(reducer(ticked, { type: "setNow", now: NOW + 30_000 }), ticked);
});
