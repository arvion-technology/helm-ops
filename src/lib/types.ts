/** Domain types for the Helm Ops console. */

export const SEVERITIES = ["SEV1", "SEV2", "SEV3", "SEV4"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INCIDENT_STATUSES = ["triage", "mitigating", "monitoring", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const DEPLOY_STATUSES = ["in-progress", "succeeded", "failed", "rolled-back"] as const;
export type DeployStatus = (typeof DEPLOY_STATUSES)[number];

export type Environment = "prod" | "staging";
export type Tab = "incidents" | "deploys" | "oncall" | "runbooks";
export type ServiceTier = "critical" | "standard";
export type OnCallRole = "primary" | "secondary";

export interface Service {
  id: string;
  name: string;
  tier: ServiceTier;
  owner: string;
}

export type TimelineKind = "opened" | "ack" | "status" | "note" | "escalation" | "deploy";

export interface TimelineEntry {
  id: string;
  at: number;
  kind: TimelineKind;
  actor: string;
  text: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  serviceId: string;
  commander: string;
  openedAt: number;
  acknowledgedAt: number | null;
  resolvedAt: number | null;
  impact: string;
  affectedSessions: number;
  runbookId: string | null;
  timeline: TimelineEntry[];
}

export interface Deploy {
  id: string;
  serviceId: string;
  version: string;
  environment: Environment;
  status: DeployStatus;
  at: number;
  durationSec: number;
  actor: string;
  commit: string;
  note: string | null;
  rollbackOf: string | null;
}

export interface OnCallShift {
  id: string;
  serviceId: string;
  person: string;
  role: OnCallRole;
  startsAt: number;
  endsAt: number;
}

export interface EscalationStep {
  afterMinutes: number;
  role: string;
  channel: string;
}

export interface Roster {
  shifts: OnCallShift[];
  escalation: Record<Severity, EscalationStep[]>;
}

export interface Runbook {
  id: string;
  title: string;
  serviceId: string;
  owner: string;
  tags: string[];
  steps: string[];
  updatedAt: number;
}

export interface OpsData {
  services: Service[];
  incidents: Incident[];
  deploys: Deploy[];
  roster: Roster;
  runbooks: Runbook[];
}

export interface Filters {
  severity: Severity | "all";
  status: "active" | "all";
  query: string;
  environment: Environment | "all";
}

/** Labels are used by the UI and by the tests that assert rendered-facing text. */
export const SEVERITY_LABEL: Record<Severity, string> = {
  SEV1: "Critical",
  SEV2: "Major",
  SEV3: "Minor",
  SEV4: "Notice",
};

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  triage: "Triage",
  mitigating: "Mitigating",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

export const TAB_LABEL: Record<Tab, string> = {
  incidents: "Incident board",
  deploys: "Deploy timeline",
  oncall: "On-call roster",
  runbooks: "Runbooks",
};

export const TABS: Tab[] = ["incidents", "deploys", "oncall", "runbooks"];
