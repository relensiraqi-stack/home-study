import { Label } from "@/client/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";

const NONE = "none";

/** Picks one of the library's grades, or none. */
export function GradeSelect({
  grades,
  value,
  onChange,
}: {
  grades: { id: string; title: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const items = [{ value: NONE, label: "No grade" }, ...grades.map((g) => ({ value: g.id, label: g.title }))];
  return (
    <div className="space-y-2">
      <Label id="learner-grade-label">Grade</Label>
      <Select
        items={items}
        value={value ?? NONE}
        onValueChange={(next) => onChange(!next || next === NONE ? null : String(next))}
      >
        <SelectTrigger data-testid="learner-grade" aria-labelledby="learner-grade-label" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
