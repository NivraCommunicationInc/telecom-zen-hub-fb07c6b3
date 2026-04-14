/**
 * HoneypotField — Hidden anti-bot field.
 * Real users never see or fill this. Bots auto-fill it.
 * Use `isHoneypotTriggered(value)` to silently reject.
 */

interface HoneypotFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export default function HoneypotField({ value, onChange }: HoneypotFieldProps) {
  return (
    <input
      type="text"
      name="website"
      autoComplete="off"
      tabIndex={-1}
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0, overflow: "hidden" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function isHoneypotTriggered(value: string): boolean {
  return value !== "";
}
