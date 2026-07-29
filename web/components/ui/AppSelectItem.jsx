"use client";

import { Select } from "radix-ui";
import { Check } from "lucide-react";
import { EMPTY_SELECT_VALUE } from "../../lib/selectEmptyValue";

export default function AppSelectItem({ value, disabled = false, children }) {
  const itemValue = String(value) === "" ? EMPTY_SELECT_VALUE : String(value);
  return (
    <Select.Item className="app-select-item" value={itemValue} disabled={disabled}>
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="app-select-item-indicator">
        <Check size={14} />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
