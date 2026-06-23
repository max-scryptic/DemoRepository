import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950",
        secondary: "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        outline: "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300",
        teal: "border-transparent bg-teal-50 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200",
        success: "border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
