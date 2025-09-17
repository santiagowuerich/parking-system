import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SectionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    icon?: React.ReactNode;
    disabled?: boolean;
  }[];
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  icon,
  children,
  actions = [],
  className = '',
  headerClassName = '',
  contentClassName = ''
}) => {
  return (
    <Card className={cn('dark:bg-zinc-900 dark:border-zinc-800', className)}>
      <CardHeader className={cn('pb-4', headerClassName)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <div className="text-gray-600 dark:text-zinc-400">
                {icon}
              </div>
            )}
            <div>
              <CardTitle className="text-gray-900 dark:text-zinc-100">
                {title}
              </CardTitle>
              {description && (
                <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions.length > 0 && (
            <div className="flex gap-2">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
};