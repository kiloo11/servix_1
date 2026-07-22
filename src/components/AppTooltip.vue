<template>
  <TooltipProvider :delay-duration="250">
    <TooltipRoot>
      <TooltipTrigger as-child><slot /></TooltipTrigger>
      <TooltipPortal v-if="label">
        <TooltipContent class="tooltip-content" :side="side" :side-offset="6">
          {{ label }}
          <TooltipArrow class="tooltip-arrow" :width="8" :height="5" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script>
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from "reka-ui";

export default {
  components: { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger },
  props: {
    label: { type: String, default: "" },
    side: { type: String, default: "top" }
  }
};
</script>
