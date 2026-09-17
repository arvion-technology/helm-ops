/**
 * Typed selectors. Components never compute a number themselves: they call one
 * of these with the whole state, which keeps the render functions boring and the
 * business rules testable without a DOM.
 */

import { ESCALATION_POLICY } from "./data.ts";
import {
  currentOnCallShift,
} from "./state.ts";
import type { AppState } from "./state.ts";
import {
  SEVERITIES,
} from "./types.ts";
import type {
  Deploy, DeployStatus, Environment, EscalationStep, Incident, IncidentStatus,
  OnCallShift, Runbook, Service, Severity,
} from "./types.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const SEVERITY_RANK: Record<Severity, number> = { SEV1: 0, SEV2: 1, SEV3: 2, SEV4: 3 };
const STATUS_RANK: Record<IncidentStatus, number> = {
  triage: 0,
  mitigating: 1,
  monitoring: 2,
  resolved: 3,
};

export function severityRank(severity: Severity): number {
  return SEVERITY_RANK[severity];
}

export function statusRank(status: IncidentStatus): number {
  return STATUS_RANK[status];
}

export function isOpen(incident: Incident): boolean {
  return incident.status !== "resolved";
}

function bySeverityThenAge(a: Incident, b: Incident): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    a.openedAt - b.openedAt
  );
}

function matchesQuery(incident: Incident, service: Service | undefined, query: string): boolean {
  if (!query) return true;
  const haystack = [
    incident.id,
    incident.title,
    incident.commander,
    incident.impact,
    incident.severity,
    incident.status,
    service?.name ?? "",
    service?.owner ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function selectVisibleIncidents(state: AppState): Incident[] {
  const { filters } = state;
  return state.incidents
    .filter((incident) => (filters.status === "active" ? isOpen(incident) : true))
    .filter((incident) => (filters.severity === "all" ? true : incident.severity === filters.severity))
    .filter((incident) =>
      matchesQuery(incident, state.services.find((service) => service.id === incident.serviceId), filters.query),
    )
    .sort(bySeverityThenAge);
}

export function selectIncident(state: AppState, id: string | null): Incident | null {
  if (!id) return null;
  return state.incidents.find((incident) => incident.id === id) ?? null;
}

export function selectSelectedIncident(state: AppState): Incident | null {
  return selectIncident(state, state.selectedIncidentId);
}

export interface Kpis {
  openIncidents: number;
  sev1Open: number;
  unacknowledged: number;
  mttrMinutes: number | null;
  deploys24h: number;
  deploySuccessRate: number | null;
  rollbacks24h: number;
  onCallCovered: number;
  servicesTotal: number;
}

export function selectMttrMinutes(incidents: Incident[]): number | null {
  const resolved = incidents.filter((incident) => incident.resolvedAt !== null);
  if (resolved.length === 0) return null;
  const total = resolved.reduce(
    (sum, incident) => sum + ((incident.resolvedAt ?? incident.openedAt) - incident.openedAt) / MINUTE,
    0,
  );
  return total / resolved.length;
}

export function selectKpis(state: AppState): Kpis {
  const open = state.incidents.filter(isOpen);
  const production = state.deploys.filter(
    (deploy) => deploy.environment === "prod" && deploy.at >= state.now - DAY,
  );
  const finished = production.filter((deploy) => deploy.status !== "in-progress");
  const succeeded = finished.filter((deploy) => deploy.status === "succeeded").length;
  const covered = state.services.filter(
    (service) => currentOnCallShift(state.roster, service.id, state.now, "primary") !== null,
  ).length;
  return {
    openIncidents: open.length,
    sev1Open: open.filter((incident) => incident.severity === "SEV1").length,
    unacknowledged: open.filter((incident) => incident.acknowledgedAt === null).length,
    mttrMinutes: selectMttrMinutes(state.incidents),
    deploys24h: production.length,
    deploySuccessRate: finished.length > 0 ? succeeded / finished.length : null,
    rollbacks24h: production.filter((deploy) => deploy.status === "rolled-back").length,
    onCallCovered: covered,
    servicesTotal: state.services.length,
  };
}

export function selectDeployFeed(state: AppState): Deploy[] {
  return state.deploys
    .filter((deploy) => state.filters.environment === "all" || deploy.environment === state.filters.environment)
    .slice()
    .sort((a, b) => b.at - a.at);
}

export interface DeployStats {
  total: number;
  inProgress: number;
  succeeded: number;
  failed: number;
  rolledBack: number;
  finished: number;
  successRate: number | null;
  medianDurationSec: number | null;
}

export function deployStats(deploys: Deploy[]): DeployStats {
  const finished = deploys.filter((deploy) => deploy.status !== "in-progress");
  const succeeded = finished.filter((deploy) => deploy.status === "succeeded").length;
  const durations = finished.map((deploy) => deploy.durationSec).sort((a, b) => a - b);
  const median =
    durations.length === 0
      ? null
      : durations.length % 2 === 1
        ? durations[(durations.length - 1) / 2] ?? null
        : ((durations[durations.length / 2 - 1] ?? 0) + (durations[durations.length / 2] ?? 0)) / 2;
  return {
    total: deploys.length,
    inProgress: deploys.filter((deploy) => deploy.status === "in-progress").length,
    succeeded,
    failed: finished.filter((deploy) => deploy.status === "failed").length,
    rolledBack: finished.filter((deploy) => deploy.status === "rolled-back").length,
    finished: finished.length,
    successRate: finished.length > 0 ? succeeded / finished.length : null,
    medianDurationSec: median,
  };
}

export function selectDeployStats(state: AppState): DeployStats {
  return deployStats(
    state.deploys.filter(
      (deploy) => deploy.environment === "prod" && deploy.at >= state.now - DAY,
    ),
  );
}

export function selectDeploysPerService(state: AppState): { service: Service; count: number; failed: number }[] {
  return state.services
    .map((service) => {
      const rows = state.deploys.filter(
        (deploy) => deploy.serviceId === service.id && deploy.at >= state.now - DAY,
      );
      return {
        service,
        count: rows.length,
        failed: rows.filter((deploy) => deploy.status === "failed" || deploy.status === "rolled-back").length,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.service.name.localeCompare(b.service.name));
}

export function selectDeployStatusCounts(deploys: Deploy[]): { status: DeployStatus; count: number }[] {
  const order: DeployStatus[] = ["in-progress", "succeeded", "failed", "rolled-back"];
  return order.map((status) => ({
    status,
    count: deploys.filter((deploy) => deploy.status === status).length,
  }));
}

export interface OnCallRow {
  service: Service;
  primary: OnCallShift | null;
  secondary: OnCallShift | null;
  endsAt: number | null;
}

export function selectCurrentOnCall(state: AppState): OnCallRow[] {
  return state.services.map((service) => {
    const primary = currentOnCallShift(state.roster, service.id, state.now, "primary");
    const secondary = currentOnCallShift(state.roster, service.id, state.now, "secondary");
    return { service, primary, secondary, endsAt: primary?.endsAt ?? null };
  });
}

export interface Handoff {
  service: Service;
  person: string;
  startsAt: number;
  endsAt: number;
}

export function selectHandoffs(state: AppState, limit = 5): Handoff[] {
  const rows: Handoff[] = [];
  for (const service of state.services) {
    const next = state.roster.shifts
      .filter(
        (shift) =>
          shift.serviceId === service.id && shift.role === "primary" && shift.startsAt > state.now,
      )
      .sort((a, b) => a.startsAt - b.startsAt)[0];
    if (next) {
      rows.push({ service, person: next.person, startsAt: next.startsAt, endsAt: next.endsAt });
    }
  }
  return rows.sort((a, b) => a.startsAt - b.startsAt).slice(0, limit);
}

export interface EscalationHint {
  severity: Severity;
  steps: EscalationStep[];
  current: EscalationStep;
  next: EscalationStep | null;
  nextAt: number | null;
  minutesOpen: number;
}

/**
 * Where an incident sits on its severity's escalation ladder. The clock starts
 * when the incident opens, which is intentionally conservative: acknowledging
 * does not buy more time before the manager is called.
 */
export function selectEscalationHint(state: AppState, incident: Incident): EscalationHint {
  const steps = ESCALATION_POLICY[incident.severity];
  const minutesOpen = Math.max(0, (state.now - incident.openedAt) / MINUTE);
  const reached = steps.filter((step) => minutesOpen >= step.afterMinutes);
  const current = reached[reached.length - 1] ?? steps[0];
  const next = steps.find((step) => step.afterMinutes > minutesOpen) ?? null;
  return {
    severity: incident.severity,
    steps,
    current,
    next,
    nextAt: next ? incident.openedAt + next.afterMinutes * MINUTE : null,
    minutesOpen,
  };
}

export interface ActiveEscalation {
  incident: Incident;
  hint: EscalationHint;
  primary: string | null;
}

export function selectActiveEscalations(state: AppState): ActiveEscalation[] {
  return state.incidents
    .filter((incident) => isOpen(incident) && (incident.severity === "SEV1" || incident.severity === "SEV2"))
    .sort(bySeverityThenAge)
    .map((incident) => ({
      incident,
      hint: selectEscalationHint(state, incident),
      primary: currentOnCallShift(state.roster, incident.serviceId, state.now, "primary")?.person ?? null,
    }));
}

export interface RunbookMatch {
  runbook: Runbook;
  score: number;
  matched: string[];
}

/** Ranked search over titles, tags, service names and step text. */
export function selectRunbookMatches(state: AppState): RunbookMatch[] {
  const tokens = state.runbookQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const results = state.runbooks.map((runbook) => {
    const service = state.services.find((row) => row.id === runbook.serviceId);
    const title = runbook.title.toLowerCase();
    const tags = runbook.tags.join(" ").toLowerCase();
    const steps = runbook.steps.join(" ").toLowerCase();
    const serviceText = `${service?.name ?? ""} ${service?.owner ?? ""}`.toLowerCase();
    const matched: string[] = [];
    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) {
        score += 8;
        matched.push("title");
      }
      if (tags.includes(token)) {
        score += 5;
        matched.push("tag");
      }
      if (serviceText.includes(token)) {
        score += 3;
        matched.push("service");
      }
      if (steps.includes(token)) {
        score += 2;
        matched.push("step");
      }
    }
    return { runbook, score, matched: [...new Set(matched)] };
  });
  return results
    .filter((row) => tokens.length === 0 || row.score > 0)
    .sort((a, b) => b.score - a.score || b.runbook.updatedAt - a.runbook.updatedAt || a.runbook.title.localeCompare(b.runbook.title));
}

export function selectSelectedRunbook(state: AppState): Runbook | null {
  const byId = state.runbooks.find((runbook) => runbook.id === state.selectedRunbookId);
  if (byId) return byId;
  return selectRunbookMatches(state)[0]?.runbook ?? null;
}

export function selectTagCounts(runbooks: Runbook[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const runbook of runbooks) {
    for (const tag of runbook.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface ServiceStatusRow {
  service: Service;
  openIncidents: number;
  worstSeverity: Severity | null;
  lastDeploy: Deploy | null;
  onCall: string | null;
}

export function selectServiceStatus(state: AppState): ServiceStatusRow[] {
  return state.services.map((service) => {
    const incidents = state.incidents.filter(
      (incident) => incident.serviceId === service.id && isOpen(incident),
    );
    const worst = incidents
      .slice()
      .sort(bySeverityThenAge)[0];
    const deploys = state.deploys
      .filter((deploy) => deploy.serviceId === service.id)
      .sort((a, b) => b.at - a.at);
    return {
      service,
      openIncidents: incidents.length,
      worstSeverity: worst?.severity ?? null,
      lastDeploy: deploys[0] ?? null,
      onCall: currentOnCallShift(state.roster, service.id, state.now, "primary")?.person ?? null,
    };
  });
}

export function selectServiceName(state: AppState, serviceId: string): string {
  return state.services.find((service) => service.id === serviceId)?.name ?? serviceId;
}

export function selectService(state: AppState, serviceId: string): Service | null {
  return state.services.find((service) => service.id === serviceId) ?? null;
}

export function selectEnvironmentLabel(environment: Environment | "all"): string {
  return environment === "all" ? "All environments" : environment === "prod" ? "Production" : "Staging";
}

export function selectSeverityOptions(): Severity[] {
  return [...SEVERITIES];
}

export function selectDeployAge(deploy: Deploy, now: number): number {
  return Math.max(0, now - deploy.at);
}

export { HOUR };
