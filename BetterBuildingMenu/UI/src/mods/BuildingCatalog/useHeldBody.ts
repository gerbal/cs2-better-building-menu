import { useValue } from "cs2/api";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CatalogSection } from "domain/buildingCatalog";
import { menuPickOf } from "domain/menuPicks";
import { menusDrawingNoGroups } from "domain/opensOnAll";
import { AssetMenu$, AssetMenuGroups$ } from "mods/bindings";
import { useOnAllInput } from "mods/useOnAllInput";

/**
 * Whether the page draws its groups' labels while the UI names the open menu a small menu that draws no
 * groups: C# counts a menu with its first page, grouped by its default, and hears that it draws none only
 * from the UI, a frame later, when it sends the page without groups. Only the first such page since the
 * menu opened: one C# answers grouped again draws, so no page is held twice. A GROUP pick or a search
 * holds nothing. See docs/design-notes.md, "The bodies".
 */
export function useAwaitsNoGroups(page: unknown, sections: readonly CatalogSection[], searching: boolean): boolean {
  const menu = useValue(AssetMenu$);
  const picked = menuPickOf(useValue(AssetMenuGroups$), menu) !== "";
  const small = useOnAllInput();
  const drawsNoGroups = useMemo(() => menusDrawingNoGroups(small).includes(menu), [small, menu]);
  const awaits = drawsNoGroups && !picked && !searching && sections.some((section) => section.kind === "group");

  // The first page the open menu awaited on, met in the render that draws it.
  const [first, setFirst] = useState<{ menu: string; page: unknown }>({ menu: "", page: null });
  if (first.menu !== menu || (awaits && first.page === null)) setFirst({ menu, page: awaits ? page : null });
  return awaits && (first.menu !== menu || first.page === null || first.page === page);
}

/** What was drawn before while `hold`; else what is drawn now, which the next hold keeps. */
export function useHeld<T>(drawn: T, hold: boolean): T | null {
  const last = useRef<T | null>(null);
  useEffect(() => {
    if (!hold) last.current = drawn;
  });
  return hold ? last.current : drawn;
}
