# UX evaluation fixes — search headers, the strip under All menus, a repeated header

**Argues from:** `docs/ux-evaluation-2026-09-02-with-findit.md`, findings 1, 2
and 5. **Steer:** the lens UI is good enough for now, so each fix is the
smallest rule that removes the defect, and where a concept can be shed
rather than improved it is shed.

## Not in scope, and why

Finding 3 (chirps hidden behind the control pane) was measured and closed
as cm-2xvs.12: the toolbar z-index patch in `vanillaLayout.ts` is what
stacks the chirp under the pane, and the honest fix is a toast lane that
does not share the band. Neither moving the pane nor reversing the patch
is a small change, so it stays recorded. Findings 4, 6, 7 and 8 are
pixel-level and wait.

## 1. Search results: headers collide (finding 1)

`GroupedResults` lays sibling groups out as a wrapping row, each group as
wide as its own tiles, with its heading out of flow. That is right for a
menu of large groups and wrong for a search: every hit group is one to
three tiles, so a two-level group (category → tier) flows beside a
one-level group and their headings share a line, and a one-tile group's
label is cut to nine characters ("ROAD SER…").

Two rules, both in the renderer and its stylesheet:

- **A group with sub-groups takes the whole row.** `.groupBand` (`flex: 0 0
  100%`) on any group whose node has children, so its heading sits alone on
  its line and its children's headings on the next.
- **A leaf group keeps three tiles of label room.** `.group { min-width:
  300rem }` (three default tiles), and the tile-count estimate
  `fitGroupLabel` budgets at least three tiles. A one-tile group still
  flows beside its siblings; it just carries its name.

Tests: a render test over `GroupedResults` (band class on a parent, none
on a leaf), `fitGroupLabel("ROAD SERVICES", 1)` whole, and two stylesheet
contracts.

## 2. The strip under All menus (finding 2)

Unscoped, the strip publishes every category of every menu and wraps to
four rows of icon-only tabs. Shed it: **the strip draws nothing while the
lens is unscoped.** `shouldShowCategoryStrip(categories, menu)` is false
for a blank menu, and the component's branch and school-tier segments obey
the same guard. Under All menus the categories are still the group
headings (grouped by development) and the toolbar's menus.

Roads' second row (21 tabs at the strip's 537px) is left; it is usable.

Tests: the domain rule, and a render test that the strip is empty for a
blank menu and draws tabs for "Roads".

## 3. A nested group named like its parent (finding 5)

Grouped by menu category the path is `[category, dev-tree branch]`, and
the Roads tree names its base branch after its category, so "Medium Roads"
has a child "Medium Roads" beside "Bridges". **A nested node whose label
equals its parent's draws no heading and reserves no heading row**
(`.groupUnlabeled`); its tiles sit directly under the parent's heading and
its labelled siblings keep theirs. The count is the parent's; the
sub-count is on the sibling.

Tests: render test — the same-named child has no heading and the
`groupUnlabeled` class; a differently named child keeps its heading.

## Live check

Deploy to `949230-c`, recapture shots 3 (search `tre` in Roads), 8 (Roads
after the upstream panel closes) and 11 (All menus), measure that no two
headings share a y within one group, that the strip is absent under All
menus, and that "Medium Roads" appears once.
