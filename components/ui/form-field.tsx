import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  error,
  hint,
  className = '',
  labelClassName = '',
  inputClassName = '',
  disabled = false
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <Label
        htmlFor={id}
        className={cn('dark:text-zinc-400', labelClassName)}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100',
          error && 'border-red-500 dark:border-red-500',
          inputClassName
        )}
      />
      {hint && !error && (
        <p className="text-sm text-gray-500 dark:text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};