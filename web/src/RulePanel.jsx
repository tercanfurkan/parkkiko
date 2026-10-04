import { RULE_TYPES, spaceLabel } from "./style.js";

export default function RulePanel({ area }) {
  if (!area) return <div className="panel">Tap a street section to see its rule.</div>;
  const { label } = RULE_TYPES[area.rule_type] ?? RULE_TYPES.unknown;
  const space = spaceLabel(area.tyyppi);
  return (
    <div className="panel">
      {/* "No parking" covers the ban types already, so only add a space type that says more */}
      <strong>{space && space !== label ? `${label}: ${space}` : label}</strong>
      {area.status === "missing_hours" && <div>The register does not publish hours here.</div>}
      {area.status === "uncertain" && <div className="warn">Not certain: {area.reason}</div>}
      {area.extra_info && <div>Sign note: {area.extra_info}</div>}
    </div>
  );
}
