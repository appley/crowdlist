import { CheckCircle2, Info } from "lucide-react";

interface ToastProps {
  message: string;
  tone?: "success" | "info";
}

export function Toast({ message, tone = "info" }: ToastProps) {
  const Icon = tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={`toast toast--${tone}`} role="status">
      <Icon size={19} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
