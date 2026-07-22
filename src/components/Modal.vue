<template>
  <DialogRoot :open="modelValue" @update:open="$emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="modal-shell" />
      <DialogContent class="modal-card" :class="cardClass">
        <div class="dialog-head">
          <DialogTitle as-child><h2><slot name="title" /></h2></DialogTitle>
          <DialogClose as-child>
            <button class="icon-button" type="button" :aria-label="closeLabel"><XIcon :size="20" /></button>
          </DialogClose>
        </div>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script>
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";
import { X as XIcon } from "@lucide/vue";

export default {
  components: { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, XIcon },
  props: {
    modelValue: { type: Boolean, default: false },
    cardClass: { type: String, default: "" },
    closeLabel: { type: String, default: "Close" }
  },
  emits: ["update:modelValue"]
};
</script>
