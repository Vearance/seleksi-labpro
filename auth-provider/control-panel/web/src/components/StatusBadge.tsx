import { CircleCheck, CircleX } from "lucide-react";

/** Status pill with an icon; green/red reserved for status meaning only. */
export default function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span className={`badge ${active ? "badge-active" : "badge-inactive"}`}>
      {active ? <CircleCheck size={14} /> : <CircleX size={14} />}
      {status}
    </span>
  );
}
