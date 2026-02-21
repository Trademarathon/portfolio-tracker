"use client";

import { Children, cloneElement, Fragment, isValidElement, ReactNode } from "react";

const LAYOUT_SEGMENT_KEY = "layout-segment-0";

/**
 * Ensures each child has a unique key when Next.js passes nodes to OuterLayoutRouter.
 * Fixes: "Each child in a list should have a unique key prop" from layout router.
 * Always returns a single keyed node so the framework's list never sees unkeyed siblings.
 */
export function KeyedChildren({ children }: { children: ReactNode }) {
    const array = Children.toArray(children);
    if (array.length === 0) return null;

    // Return a single wrapper element to satisfy OuterLayoutRouter's list requirement.
    // style={{ display: 'contents' }} ensures the wrapper doesn't affect the CSS layout (flex/grid).
    return (
        <div style={{ display: 'contents' }}>
            {array.map((child, index) => {
                if (child == null) return null;
                const key = isValidElement(child) && child.key != null && child.key !== undefined
                    ? child.key
                    : `layout-segment-${index}`;

                if (isValidElement(child) && (child.key == null || child.key === undefined)) {
                    return cloneElement(child, { key });
                }
                return <Fragment key={key}>{child}</Fragment>;
            })}
        </div>
    );
}
