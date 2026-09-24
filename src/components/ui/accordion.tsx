"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("w-full", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-ink/10 last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          // Layout
          "flex w-full flex-1 items-center justify-between gap-4 py-5 text-left",
          // Type
          "font-serif text-lg font-medium tracking-[-0.01em] text-ink md:text-xl",
          // Interaction
          "rounded-sm outline-none transition-colors hover:text-ink/80",
          "focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ana-1",
          // Spin the chevron when expanded — Base UI flips data-panel-open on
          // the trigger when its panel is open.
          "[&[data-panel-open]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          className="size-5 shrink-0 text-ink/50 transition-transform duration-200"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Panel>) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        // Base UI animates a CSS variable --accordion-panel-height between
        // 0 and the panel's natural height when opening/closing. We tween
        // height + opacity on that var so the answer slides open smoothly.
        "overflow-hidden text-base leading-relaxed text-ink/70",
        "data-[starting-style]:h-0 data-[ending-style]:h-0",
        "h-[var(--accordion-panel-height)]",
        "transition-[height,opacity] duration-300 ease-out",
        "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        className,
      )}
      {...props}
    >
      <div className="pb-5 pr-10">{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
