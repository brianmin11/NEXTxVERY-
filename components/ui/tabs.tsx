"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

/**
 * Figma 세그먼트 탭: 밑줄 하나 위에 글자만 놓고, 활성 탭은 색 + 굵기 + 2px 표시줄로 구분한다.
 * 모바일 터치 영역 48px(h-12). `segment` 변형은 회색 바탕의 둥근 토글.
 */
const tabsListVariants = cva(
  "group/tabs-list inline-flex items-center justify-center text-muted-foreground group-data-horizontal/tabs:h-12 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "w-full rounded-none border-b border-border bg-transparent p-0",
        segment: "w-fit rounded-lg bg-muted p-[3px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full flex-1 items-center justify-center gap-1.5 border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // 밑줄형(기본)
        "group-data-[variant=default]/tabs-list:rounded-none group-data-[variant=default]/tabs-list:data-active:font-bold group-data-[variant=default]/tabs-list:data-active:text-primary",
        "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary after:opacity-0 after:transition-opacity group-data-[variant=default]/tabs-list:data-active:after:opacity-100",
        // 토글형
        "group-data-[variant=segment]/tabs-list:h-[calc(100%-1px)] group-data-[variant=segment]/tabs-list:rounded-md group-data-[variant=segment]/tabs-list:after:hidden group-data-[variant=segment]/tabs-list:data-active:bg-background group-data-[variant=segment]/tabs-list:data-active:font-semibold group-data-[variant=segment]/tabs-list:data-active:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-base outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
