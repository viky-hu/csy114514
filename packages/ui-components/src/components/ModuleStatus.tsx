export type ModuleStatusTone = "ready" | "building" | "planned";

type ModuleStatusProps = {
  label: string;
  value: string;
  tone?: ModuleStatusTone;
};

const toneClassName: Record<ModuleStatusTone, string> = {
  ready: "csy-status--ready",
  building: "csy-status--building",
  planned: "csy-status--planned"
};

export function ModuleStatus({
  label,
  value,
  tone = "planned"
}: ModuleStatusProps) {
  return (
    <div className={`csy-status ${toneClassName[tone]}`}>
      <span className="csy-status__label">{label}</span>
      <strong className="csy-status__value">{value}</strong>
    </div>
  );
}
