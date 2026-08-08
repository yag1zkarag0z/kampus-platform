"use client";

import { useRouter } from "next/navigation";
import {
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from "react";

const interactiveElementSelector = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "label",
  "summary",
  "audio",
  "video",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "[data-post-card-interactive]",
].join(",");

type CampusPostCardSurfaceProps = ComponentPropsWithoutRef<"article"> & {
  postId: string;
};

export default function CampusPostCardSurface({
  postId,
  className = "",
  onClick,
  ...props
}: CampusPostCardSurfaceProps) {
  const router = useRouter();

  const openPost = (event: MouseEvent<HTMLElement>) => {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;

    if (
      !(target instanceof Element) ||
      target.closest(interactiveElementSelector)
    ) {
      return;
    }

    const selection = window.getSelection();

    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      return;
    }

    router.push(`/gonderi/${encodeURIComponent(postId)}`);
  };

  return (
    <article
      {...props}
      onClick={openPost}
      className={`cursor-pointer transition-colors duration-200 hover:bg-brand/5 ${className}`}
    />
  );
}
