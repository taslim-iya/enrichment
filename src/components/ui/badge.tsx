import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-[#1f1f2e] px-2 py-0.5 text-xs font-medium',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
