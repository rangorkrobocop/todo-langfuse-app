import { cx } from '@/utilities/cx';
import { kebabCase } from 'change-case';
import type { ComponentProps } from 'react';

export type InputProps = ComponentProps<'input'> & {
  label: string;
};

export const Input = ({
  label,
  className,
  required,
  id = kebabCase(label),
  ...props
}: InputProps) => {
  return (
    <label
      htmlFor={id}
      className="block text-sm font-semibold text-[var(--text-secondary)] mb-2"
      id={`${id}-label`}
    >
      <div
        className={cx(
          'flex items-center gap-1',
          required &&
          "after:h-1 after:w-1 after:rounded-full after:bg-[var(--accent)] after:content-['']",
        )}
      >
        {label}
        {required && <span className="sr-only">(Required)</span>}
      </div>

      <input
        id={id}
        className={cx(
          'ag-input mt-1',
          className,
        )}
        required={required}
        aria-labelledby={`${id}-label`}
        aria-required={required ? 'true' : undefined}
        {...props}
      />
    </label>
  );
};
