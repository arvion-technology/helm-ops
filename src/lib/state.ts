/**
 * One reducer for the whole console. Every mutation returns a new state, and
 * every status change is pushed onto a bounded history stack so the incident
 * commander can undo a misclick without reloading the page.
 */

import { createOpsData } from "./data.ts";
import {
  INCIDENT_STATUSES, TABS,
} from "./types.ts";
import type {
  Deploy, Filters, Incident, IncidentStatus, OpsData, Runbook, Service,
  Severity, Tab, Roster, TimelineEntry,
} from "./types.ts";

const HISTORY_LIMIT = 20;

export interface HistoryEntry {
  incidents: Incident[];
  label: string;
  at: number;
}

export interface AppState extends OpsData {
  now: number;
  tab: Tab;
  filters: Filters;
  selectedIncidentId: string | null;
  selectedRunbookId: string | null;
  runbookQuery: string;
  history: HistoryEntry[];
}

export type Action =
  | { type: "setTab"; tab: Tab }
  | { type: "setNow"; now: number }
  | { type: "acknowledge"; id: string; at?: number }
  | { type: "advance"; id: string; at?: number }
  | { type: "logNote"; id: string; text: string; at?: number }
  | { type: "undo" }
  | { type: "setFilters"; patch: Partial<Filters> }
  | { type: "selectIncident"; id: string | null }
  | { type: "selectRunbook"; id: string | null }
  | { type: "setRunbookQuery"; query: string };

function firstOpenIncident(incidents: Incident[]): Incident | null {
  const open = incidents.filter((incident) => incident.status !== "resolved");
  const rank: Record<Severity, number> = { SEV1: 0, SEV2: 1, SEV3: 2, SEV4: 3 };
  return (
    [...open].sort(
      (a, b) => rank[a.severity] - rank[b.severity] || a.openedAt - b.openedAt,
    )[0] ?? null
  );
}

export function createInitialState(now: number = Date.now()): AppState {
  const data = createOpsData(now);
  const selected = firstOpenIncident(data.incidents);
  return {
    ...data,
    now,
    tab: "incidents",
    filters: { severity: "all", status: "active", query: "", environment: "prod" },
    selectedIncidentId: selected?.id ?? null,
    selectedRunbookId: data.runbooks[0]?.id ?? null,
    runbookQuery: "",
    history: [],
  };
}

export function nextStatus(status: IncidentStatus): IncidentStatus | null {
  const index = INCIDENT_STATUSES.indexOf(status);
  if (index < 0 || index === INCIDENT_STATUSES.length - 1) return null;
  return INCIDENT_STATUSES[index + 1] ?? null;
}

function timelineEntry(incident: Incident, kind: TimelineEntry["kind"], actor: string, text: string, at: number): TimelineEntry {
  return {
    id: `${incident.id}-entry-${incident.timeline.length + 1}`,
    at,
    kind,
    actor,
    text,
  };
}

function replaceIncident(incidents: Incident[], next: Incident): Incident[] {
  return incidents.map((incident) => (incident.id === next.id ? next : incident));
}

function withHistory(state: AppState, label: string, at: number): HistoryEntry[] {
  const entry: HistoryEntry = { incidents: state.incidents, label, at };
  return [entry, ...state.history].slice(0, HISTORY_LIMIT);
}

function findIncident(state: AppState, id: string): Incident | null {
  return state.incidents.find((incident) => incident.id === id) ?? null;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setTab": {
      if (!TABS.includes(action.tab) || state.tab === action.tab) return state;
      return { ...state, tab: action.tab };
    }

    case "setNow": {
      if (action.now === state.now) return state;
      return { ...state, now: action.now };
    }

    case "acknowledge": {
      const incident = findIncident(state, action.id);
      if (!incident || incident.acknowledgedAt !== null || incident.status === "resolved") return state;
      const at = action.at ?? state.now;
      const next: Incident = {
        ...incident,
        acknowledgedAt: at,
        timeline: [
          ...incident.timeline,
          timelineEntry(incident, "ack", incident.commander, "Acknowledged from the incident board.", at),
        ],
      };
      return {
        ...state,
        incidents: replaceIncident(state.incidents, next),
        history: withHistory(state, `acknowledged ${incident.id}`, at),
      };
    }

    case "advance": {
      const incident = findIncident(state, action.id);
      if (!incident) return state;
      const target = nextStatus(incident.status);
      if (!target) return state;
      const at = action.at ?? state.now;
      const next: Incident = {
        ...incident,
        status: target,
        resolvedAt: target === "resolved" ? at : incident.resolvedAt,
        timeline: [
          ...incident.timeline,
          timelineEntry(incident, "status", incident.commander, `${incident.status} to ${target}.`, at),
        ],
      };
      return {
        ...state,
        incidents: replaceIncident(state.incidents, next),
        history: withHistory(state, `${incident.id} to ${target}`, at),
        selectedIncidentId: incident.id,
      };
    }

    case "logNote": {
      const incident = findIncident(state, action.id);
      const text = action.text.trim();
      if (!incident || text.length === 0) return state;
      const at = action.at ?? state.now;
      const next: Incident = {
        ...incident,
        timeline: [...incident.timeline, timelineEntry(incident, "note", "You", text, at)],
      };
      return { ...state, incidents: replaceIncident(state.incidents, next) };
    }

    case "undo": {
      const [last, ...rest] = state.history;
      if (!last) return state;
      return {
        ...state,
        incidents: last.incidents,
        history: rest,
      };
    }

    case "setFilters": {
      return { ...state, filters: { ...state.filters, ...action.patch } };
    }

    case "selectIncident": {
      return { ...state, selectedIncidentId: action.id };
    }

    case "selectRunbook": {
      return { ...state, selectedRunbookId: action.id };
    }

    case "setRunbookQuery": {
      return { ...state, runbookQuery: action.query };
    }

    default: {
      return state;
    }
  }
}

/** Small helpers used by the components and by the tests. */
export function currentOnCallShift(
  roster: Roster,
  serviceId: string,
  now: number,
  role: "primary" | "secondary",
) {
  return (
    roster.shifts.find(
      (shift) =>
        shift.serviceId === serviceId && shift.role === role && shift.startsAt <= now && now < shift.endsAt,
    ) ?? null
  );
}

export type { Deploy, Filters, Incident, Runbook, Service, Severity, Tab };
