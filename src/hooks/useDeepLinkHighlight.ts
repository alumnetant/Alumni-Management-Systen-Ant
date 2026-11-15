/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { useAlumni } from '../context/AlumniContext';

export const HIGHLIGHT_RING_CLASS =
  'ring-2 ring-[#8B181B] dark:ring-rose-500 ring-offset-2 ring-offset-white dark:ring-offset-[#181615] shadow-[0_0_0_6px_rgba(139,24,27,0.12)] transition-all duration-300';

/**
 * Scrolls the rendered DOM element matching [data-notify-target-id="<targetId>"]
 * smoothly into the center of the viewport when highlightedItemId becomes active.
 */
export function useDeepLinkHighlight(
  candidateIds?: Array<string | undefined | null>,
  deps: unknown[] = []
) {
  const { highlightedItemId } = useAlumni();
  const scrolledIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightedItemId) {
      scrolledIdRef.current = null;
      return;
    }

    if (candidateIds && candidateIds.length > 0 && !candidateIds.includes(highlightedItemId)) {
      return;
    }

    if (scrolledIdRef.current === highlightedItemId) {
      return;
    }

    const attemptScroll = () => {
      if (typeof document === 'undefined') return false;
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(highlightedItemId)
          : highlightedItemId.replace(/"/g, '\\"');
      const el = document.querySelector(`[data-notify-target-id="${escaped}"]`);
      if (el instanceof HTMLElement) {
        scrolledIdRef.current = highlightedItemId;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };

    if (attemptScroll()) return;

    const timer1 = setTimeout(attemptScroll, 120);
    const timer2 = setTimeout(attemptScroll, 380);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [highlightedItemId, ...(candidateIds ? [candidateIds.join(',')] : []), ...deps]);

  return {
    highlightedItemId,
    isHighlighted: (id?: string | null) => Boolean(id && highlightedItemId && id === highlightedItemId)
  };
}
