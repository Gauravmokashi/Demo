'use client';

import * as RadixTabs from '@radix-ui/react-tabs';
import { ReactNode } from 'react';

type Tab = { value: string; label: string; content: ReactNode };

/** Keyboard-accessible tabs (arrow keys, roving focus) built on Radix. */
export function Tabs({ tabs, value, onChange, label }: { tabs: Tab[]; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <RadixTabs.Root value={value} onValueChange={onChange}>
      <RadixTabs.List aria-label={label} className="mb-7 flex gap-6 border-b border-[#d7ded7]">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="-mb-px border-b-2 border-transparent pb-3 text-sm font-semibold text-[#65726a] data-[state=active]:border-[#1e4935] data-[state=active]:text-[#1e4935]"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value}>
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
