"use client";

import { Accordion as RadixAccordion } from "radix-ui";
import { ChevronDown } from "lucide-react";

// Thin wrapper around radix-ui's Accordion — CSS-var-driven height animation
// (--radix-accordion-content-height, see globals.css) rather than a JS/Framer
// Motion measurement, which is the animation approach Radix's own docs
// recommend for this primitive (Framer Motion is used elsewhere: modals,
// toasts, page transitions).
export const AccordionRoot = RadixAccordion.Root;
export const AccordionItem = RadixAccordion.Item;

export function AccordionTrigger({ className = "", children, ...props }) {
  return (
    <RadixAccordion.Header>
      <RadixAccordion.Trigger className={`accordion-trigger${className ? ` ${className}` : ""}`} {...props}>
        {children}
        <ChevronDown className="accordion-chevron" size={16} />
      </RadixAccordion.Trigger>
    </RadixAccordion.Header>
  );
}

export function AccordionContent({ className = "", children, ...props }) {
  return (
    <RadixAccordion.Content className={`accordion-content${className ? ` ${className}` : ""}`} {...props}>
      <div className="accordion-content-inner">{children}</div>
    </RadixAccordion.Content>
  );
}
