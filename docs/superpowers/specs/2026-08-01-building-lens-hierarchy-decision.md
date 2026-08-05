# Building Lens hierarchy decision

**Decision:** use an explicit `Catalog` / `Tools` mode switch inside Building Lens. Catalog owns the building query and its navigation; Tools owns the six native construction handoffs. The switch is a shell-only state change, so leaving Tools does not rewrite the catalog query.

## Options considered

| Hierarchy | Discoverability | Density | Native handoff clarity | Decision |
| --- | --- | --- | --- | --- |
| Dedicated Catalog/Tools mode | High: the two workflows are named and selected state is persistent while the lens is open | High: tool cards do not consume table rows, facet space, or paging chrome | High: a tool click is visibly outside the building-result workflow | **Selected** |
| Inline Tools strip | Medium: tools are present, but users can mistake them for building filters or another row of categories | Low to medium: every catalog view pays the vertical cost | Medium: handoff is available, but the surrounding building context remains visible | Rejected for the primary hierarchy; retain only as a narrow-width fallback if needed |
| Command palette | Low for first-time users: actions are hidden behind an additional interaction | High when closed, but poor scanability when open | Medium: native handoff can be clear after search, but labels are less discoverable | Rejected |
| Left rail | Medium: persistent and scannable, but competes with the game viewport and existing FindIt alignment modes | Medium to low: consumes horizontal room beside the information table | High: separate rail communicates a different action family | Rejected for the current resizable panel; revisit if the shell becomes a docked workspace |

## Interaction contract

- `Catalog` is selected by default whenever Building Lens is enabled.
- `Catalog` shows the existing section tabs, subcategory tabs, facets, table rows, and page controls.
- `Tools` has a selected mode state and hides catalog section/subcategory navigation and catalog content, including rows and `n / m` paging.
- `Tools` shows all six stable tool descriptors. Enabled descriptors hand off to the vanilla toolbar before the successor panel closes; unavailable descriptors remain visible with a reason and have no side effects.
- Returning to `Catalog` does not issue a search, sort, facet, section, subcategory, or offset command. The existing C# query binding therefore restores the prior view unchanged.
- If the lens is closed or disabled, the shell resets to `Catalog` so reopening never starts in a stale construction mode.

## Narrow-window behavior

The mode switch is a compact two-button row using the same rem-based button sizing as the existing lens navigation. Tools content wraps its six actions and scrolls within the panel; it does not overlay the building table or the native game toolbar. The existing panel resize handle remains active only for Catalog mode, where table width is meaningful.
