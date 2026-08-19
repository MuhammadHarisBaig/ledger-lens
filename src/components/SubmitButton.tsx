"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  className?: string;
};

// For server-action <form>s: useFormStatus reports the enclosing form's pending state, so the
// button shows a spinner + pending label and disables itself (no double-submit) while the action runs.
export function SubmitButton({ children, pendingLabel, variant, size, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} loading={pending} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
