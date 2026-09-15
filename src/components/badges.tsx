import type { Severity, IncidentStatus, DeployStatus, Environment } from "../lib/types.ts";
import { SEVERITY_LABEL, STATUS_LABEL } from "../lib/types.ts";

export function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <span className={`sev-pill sev-${severity.slice(-1)}`} title={SEVERITY_LABEL[severity]}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`status-badge st-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function DeployStatusBadge({ status }: { status: DeployStatus }) {
  const label =
    status === "in-progress"
      ? "in progress"
      : status === "rolled-back"
        ? "rolled back"
        : status;
  return <span className={`deploy-badge dp-${status}`}>{label}</span>;
}

export function EnvBadge({ environment }: { environment: Environment }) {
  return <span className={`env-badge env-${environment}`}>{environment}</span>;
}

export function Avatar({ name }: { name: string }) {
  const text = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="avatar avatar-sm" aria-hidden="true">
      {text || "?"}
    </span>
  );
}

export function AckFlag() {
  return <span className="ack-flag">unacknowledged</span>;
}
