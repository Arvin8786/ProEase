import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-xs font-semibold leading-none text-slate-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-slate-300",
          className
        )}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";
