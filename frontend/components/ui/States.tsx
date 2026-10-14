import { X } from 'lucide-react';

export function EmptyState({ loading, message }: { loading: boolean; message: string }) {
  return <div className="border-y border-[#d7ded7] py-8 text-sm text-[#758078]">{loading ? 'Loading…' : message}</div>;
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between border-l-4 border-[#b45140] bg-[#f7e7e3] px-4 py-3 text-sm text-[#763b31]" role="alert">
      <span>{message}</span>
      <button aria-label="Dismiss error" onClick={onDismiss}><X size={17} /></button>
    </div>
  );
}

export function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between border-l-4 border-[#548c67] bg-[#e7f1ea] px-4 py-3 text-sm text-[#21452f]" role="status">
      <span>{message}</span>
      <button aria-label="Dismiss notice" onClick={onDismiss}><X size={17} /></button>
    </div>
  );
}
