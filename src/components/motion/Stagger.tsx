"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

const CONTAINER = { div: motion.div, ul: motion.ul, tbody: motion.tbody };
const ITEM = { div: motion.div, li: motion.li, tr: motion.tr };

type ContainerTag = keyof typeof CONTAINER;
type ItemTag = keyof typeof ITEM;

// Staggered list entrance: children fade+slide in sequence. `as` lets it be a div/ul/tbody so it
// fits tables and lists. Static under prefers-reduced-motion.
export function Stagger({
  as = "div",
  className,
  children,
}: {
  as?: ContainerTag;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const Tag = CONTAINER[as];
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag className={className} variants={container} initial="hidden" animate="show">
      {children}
    </Tag>
  );
}

export function StaggerItem({
  as = "div",
  className,
  children,
}: {
  as?: ItemTag;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const Tag = ITEM[as];
  if (reduce) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag className={className} variants={item}>
      {children}
    </Tag>
  );
}
