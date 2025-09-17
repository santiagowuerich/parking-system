import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ModalShellProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    primaryButton?: {
        label: string;
        onClick: () => void;
        disabled?: boolean;
        loading?: boolean;
    };
    secondaryButton?: {
        label: string;
        onClick: () => void;
        disabled?: boolean;
    };
    className?: string;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    showFooter?: boolean;
}

export const ModalShell: React.FC<ModalShellProps> = ({
    open,
    onOpenChange,
    title,
    description,
    children,
    primaryButton,
    secondaryButton,
    className = '',
    maxWidth = 'md',
    showFooter = true
}) => {
    const maxWidthClasses = {
        sm: 'sm:max-w-[400px]',
        md: 'sm:max-w-[500px]',
        lg: 'sm:max-w-[600px]',
        xl: 'sm:max-w-[700px]',
        '2xl': 'sm:max-w-[800px]'
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                'dark:bg-zinc-900 dark:border-zinc-800',
                maxWidthClasses[maxWidth],
                className
            )}>
                <DialogHeader>
                    <DialogTitle className="dark:text-zinc-100">
                        {title}
                    </DialogTitle>
                    {description && (
                        <DialogDescription className="dark:text-zinc-400">
                            {description}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <div className="space-y-4">
                    {children}
                </div>

                {showFooter && (primaryButton || secondaryButton) && (
                    <DialogFooter>
                        {secondaryButton && (
                            <Button
                                variant="outline"
                                onClick={secondaryButton.onClick}
                                disabled={secondaryButton.disabled}
                                className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-700"
                            >
                                {secondaryButton.label}
                            </Button>
                        )}
                        {primaryButton && (
                            <Button
                                onClick={primaryButton.onClick}
                                disabled={primaryButton.disabled || primaryButton.loading}
                                className="dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
                            >
                                {primaryButton.loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Procesando...
                                    </>
                                ) : (
                                    primaryButton.label
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};
