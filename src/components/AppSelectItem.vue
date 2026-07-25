<template>
  <SelectItem class="app-select-item" :value="itemValue" :disabled="disabled">
    <SelectItemText><slot /></SelectItemText>
    <SelectItemIndicator class="app-select-item-indicator"><CheckIcon :size="14" /></SelectItemIndicator>
  </SelectItem>
</template>

<script>
import { SelectItem, SelectItemIndicator, SelectItemText } from "reka-ui";
import { Check as CheckIcon } from "@lucide/vue";
import { EMPTY_SELECT_VALUE } from "./appSelectEmptyValue.js";

export default {
  components: { SelectItem, SelectItemIndicator, SelectItemText, CheckIcon },
  props: {
    value: { type: [String, Number], required: true },
    disabled: { type: Boolean, default: false }
  },
  computed: {
    itemValue() {
      return String(this.value) === "" ? EMPTY_SELECT_VALUE : String(this.value);
    }
  }
};
</script>
