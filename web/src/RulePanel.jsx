import { RULE_TYPES } from "./style.js";

export default function RulePanel({ area }) {
  if (!area) return <div className="panel">Tap a street section to see its rule.</div>;
  const { label } = RULE_TYPES[area.rule_type] ?? RULE_TYPES.unknown;
  return (
    <div className="panel">
      <strong>{label}</strong>
      {area.status === "missing_hours" && <div>The register does not publish hours here.</div>}
      {area.status === "uncertain" && <div className="warn">Not certain: {area.reason}</div>}
      {area.extra_info && <div>Sign note: {area.extra_info}</div>}
    </div>
  );
}
