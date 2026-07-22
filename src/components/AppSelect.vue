<template>
  <SelectRoot :model-value="stringValue" @update:model-value="handleUpdate">
    <SelectTrigger class="app-select-trigger" v-bind="$attrs">
      <SelectValue :placeholder="placeholder" />
      <SelectIcon class="app-select-icon"><ChevronDownIcon :size="16" /></SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="app-select-content" position="popper" :side-offset="6" align="start">
        <SelectScrollUpButton class="app-select-scroll"><ChevronUpIcon :size="14" /></SelectScrollUpButton>
        <SelectViewport class="app-select-viewport">
          <slot />
        </SelectViewport>
        <SelectScrollDownButton class="app-select-scroll"><ChevronDownIcon :size="14" /></SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script>
import { SelectContent, SelectIcon, SelectPortal, SelectRoot, SelectScrollDownButton, SelectScrollUpButton, SelectTrigger, SelectValue, SelectViewport } from "reka-ui";
import { ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon } from "@lucide/vue";

export default {
  inheritAttrs: false,
  components: { SelectContent, SelectIcon, SelectPortal, SelectRoot, SelectScrollDownButton, SelectScrollUpButton, SelectTrigger, SelectValue, SelectViewport, ChevronDownIcon, ChevronUpIcon },
  props: {
    modelValue: { type: [String, Number], default: "" },
    modelModifiers: { default: () => ({}) },
    placeholder: { type: String, default: "" }
  },
  emits: ["update:modelValue"],
  computed: {
    stringValue() {
      return this.modelValue === null || this.modelValue === undefined ? "" : String(this.modelValue);
    }
  },
  methods: {
    handleUpdate(value) {
      this.$emit("update:modelValue", this.modelModifiers.number ? Number(value) : value);
    }
  }
};
</script>
