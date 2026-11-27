import { Crown, Gem, User } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

const STYLES: Record<Role, string> = {
  ULTRA: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200",
  PREMIUM: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  MEMBER: "border-white/10 bg-white/[0.05] text-neutral-300",
};

const ICONS = { ULTRA: Crown, PREMIUM: Gem, MEMBER: User } as const;

/** Selo do privilégio (Ultra / Premium / Membro). */
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const Icon = ICONS[role];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STYLES[role],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {ROLE_LABELS[role]}
    </span>
  );
}
