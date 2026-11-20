import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/client/components/ui/button";

/** An admin's controls on one item of an ordered list. */
export function ItemControls({
  label,
  first,
  last,
  onMove,
  onEdit,
  onDelete,
}: {
  label: string;
  first: boolean;
  last: boolean;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button size="icon-sm" variant="ghost" data-testid="move-up" disabled={first} aria-label={`Move ${label} up`} onClick={() => onMove("up")}>
        <ArrowUp />
      </Button>
      <Button size="icon-sm" variant="ghost" data-testid="move-down" disabled={last} aria-label={`Move ${label} down`} onClick={() => onMove("down")}>
        <ArrowDown />
      </Button>
      <Button size="icon-sm" variant="ghost" data-testid="edit" aria-label={`Rename ${label}`} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button size="icon-sm" variant="ghost" data-testid="delete" aria-label={`Delete ${label}`} onClick={onDelete}>
        <Trash2 />
      </Button>
    </div>
  );
}
