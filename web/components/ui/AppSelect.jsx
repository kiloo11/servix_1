"use client";

import { Select } from "radix-ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EMPTY_SELECT_VALUE } from "../../lib/selectEmptyValue";

// React port of src/components/AppSelect.vue — same prop shape (value/onChange
// instead of v-model) and same empty-string sentinel handling.
export default function AppSelect({ value, onChange, placeholder = "", number = false, className, children, ...triggerProps }) {
  const stringValue = value === null || value === undefined || value === "" ? EMPTY_SELECT_VALUE : String(value);

  function handleChange(next) {
    const raw = next === EMPTY_SELECT_VALUE ? "" : next;
    onChange?.(number ? Number(raw) : raw);
  }

  return (
    <Select.Root value={stringValue} onValueChange={handleChange}>
      <Select.Trigger className={`app-select-trigger${className ? ` ${className}` : ""}`} {...triggerProps}>
        <Select.Value className="app-select-value" placeholder={placeholder} />
        <Select.Icon className="app-select-icon">
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="app-select-content" position="popper" sideOffset={6} align="start">
          <Select.ScrollUpButton className="app-select-scroll">
            <ChevronUp size={14} />
          </Select.ScrollUpButton>
          <Select.Viewport className="app-select-viewport">{children}</Select.Viewport>
          <Select.ScrollDownButton className="app-select-scroll">
            <ChevronDown size={14} />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
