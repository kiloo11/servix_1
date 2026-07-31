"use client";

import { Tabs as RadixTabs } from "radix-ui";

// Thin wrapper around radix-ui's Tabs, styled to match the app's existing
// pill/segment controls (see .finance-tabs in globals.css) — used to split
// a single route into logically separate sections without full page nav.
export default function Tabs({ value, onChange, tabs, children }) {
  return (
    <RadixTabs.Root className="finance-tabs-root" value={value} onValueChange={onChange}>
      <RadixTabs.List className="finance-tabs" aria-label="tabs">
        {tabs.map((tab) => (
          <RadixTabs.Trigger key={tab.value} className="finance-tab-trigger" value={tab.value}>
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}
