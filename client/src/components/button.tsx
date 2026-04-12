import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cx } from '@/utilities/cx';

const button = cva(
  [
    'disabled:pointer-events-none',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed',
    'disabled:shadow-none',
    'disabled:transition-none',
    'outline-none',
  ],
  {
    variants: {
      variant: {
        primary: 'ag-button-primary',
        secondary: 'ag-button-secondary',
        destructive: 'ag-button-destructive',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof button>;

export const Button = ({ className, variant = 'secondary', ...props }: ButtonProps) => {
  return (
    <button
      className={cx(button({ variant }), className)}
      aria-disabled={props.disabled}
      {...props}
    />
  );
};
