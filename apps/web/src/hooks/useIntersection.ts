import { useEffect, useRef, useState } from "react";
import type React from "react";

export interface UseIntersectionOptions {
  threshold?: number;
  root?: Element | null;
  rootMargin?: string;
}

/**
 * Custom hook to observe when an element enters the viewport
 * Useful for infinite scroll implementations
 */
export function useIntersection(
  options: UseIntersectionOptions = {}
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const { threshold = 0.1, root = null, rootMargin = "0px" } = options;
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin]);

  return [ref, isIntersecting];
}
