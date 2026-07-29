"use client";

import { Tooltip } from "radix-ui";

export default function AppTooltip({ label = "", side = "top", children }) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        {label ? (
          <Tooltip.Portal>
            <Tooltip.Content className="tooltip-content" side={side} sideOffset={6}>
              {label}
              <Tooltip.Arrow className="tooltip-arrow" width={8} height={5} />
            </Tooltip.Content>
          </Tooltip.Portal>
        ) : null}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
