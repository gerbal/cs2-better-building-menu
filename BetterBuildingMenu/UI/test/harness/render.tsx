import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { installVanillaRegistry } from "./vanillaRegistry";

export { catalogPage, entry } from "./entries";

// Every render test imports this module, so the resolver is seeded once.
installVanillaRegistry();

/** What a component draws, as markup. Effects do not run; hooks do. */
export const renderHtml = (element: ReactElement): string => renderToStaticMarkup(element);

/** How many times a pattern occurs in the markup. */
export const count = (html: string, pattern: RegExp): number =>
  (html.match(new RegExp(pattern.source, "g")) ?? []).length;
