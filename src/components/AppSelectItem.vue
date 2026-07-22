<template>
  <SelectItem class="app-select-item" :value="String(value)" :disabled="disabled">
    <SelectItemText><slot /></SelectItemText>
    <SelectItemIndicator class="app-select-item-indicator"><CheckIcon :size="14" /></SelectItemIndicator>
  </SelectItem>
</template>

<script>
import { SelectItem, SelectItemIndicator, SelectItemText } from "reka-ui";
import { Check as CheckIcon } from "@lucide/vue";

export default {
  components: { SelectItem, SelectItemIndicator, SelectItemText, CheckIcon },
  props: {
    value: { type: [String, Number], required: true },
    disabled: { type: Boolean, default: false }
  }
};
</script>
