'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  description?: ReactNode;
  /** "panel" slides in from the right, for read-mostly detail views. */
  variant?: 'modal' | 'panel';
  children: ReactNode;
};

/** Accessible dialog built on Radix: focus trap, Escape to close, and labelled title/description. */
export function Dialog({ open, onClose, title, kicker, description, variant = 'modal', children }: DialogProps) {
  const content =
    variant === 'panel'
      ? 'fixed inset-y-0 right-0 z-30 flex w-full max-w-lg flex-col overflow-y-auto bg-[#fbfcfa] p-6 shadow-2xl'
      : 'fixed left-1/2 top-1/2 z-30 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-[#fbfcfa] p-6 shadow-2xl';

  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-20 bg-[#11251b]/55" />
        <RadixDialog.Content className={content}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              {kicker && <p className="section-kicker">{kicker}</p>}
              <RadixDialog.Title className="mt-1 font-serif text-xl font-semibold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-[#65726a]">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="icon-button shrink-0" aria-label={`Close ${title.toLowerCase()}`}>
              <X size={17} />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
