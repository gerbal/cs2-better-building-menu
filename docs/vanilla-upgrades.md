# How vanilla handles building upgrades and extensions

How the game's upgrade machinery works, as the mod relies on it. It names the game's types
and members, to be read in a decompilation of `Game.dll`.

## Vocabulary

Four distinct things share the word "upgrade":

| Thing | What it is |
|---|---|
| `ServiceUpgrade` (authoring) | A component declaring "this prefab can be attached to those buildings", with cost, XP and placement rules |
| `BuildingExtensionPrefab` | A `StaticObjectPrefab` that is a physical annex — position, lot size, external flag |
| `BuildingModules` | A separate list of modules a modular building takes. The City Stations DLC's bus, tram, train and subway stations, depots and yards carry one |
| `NetUpgrade` | Road-piece upgrades (lights, trees). Unrelated to buildings |

The first two **compose**: an extension prefab carrying `ServiceUpgrade` is both
an annex and an upgrade. A plain `BuildingPrefab` carrying `ServiceUpgrade` is an
upgrade that is a whole building — vanilla calls that a *sub-building*.

## The link is authored backwards

Nothing on a building lists its upgrades. The relationship is declared on the
**upgrade**, pointing at buildings, and inverted at load:

1. `ServiceUpgrade.LateInitialize` fills the upgrade prefab's
   `ServiceUpgradeBuilding` buffer from `m_Buildings`, and calls
   `BuildingPrefab.AddUpgrade`, which only *creates* an empty
   `BuildingUpgradeElement` buffer on the building.
2. `BuildingInitializeSystem.OnUpdate` walks every upgrade's
   `ServiceUpgradeBuilding` buffer and pushes a `BuildingUpgradeElement` onto each
   building it names. Removing an upgrade prefab takes its elements off again.

This is why a mod can attach an upgrade to a vanilla building without editing it.

## Placement

`ServiceUpgradeData` carries two constraints:

- `m_MaxPlacementDistance == 0` — must snap to the parent's lot edge.
  `BuildingInitializeSystem.OnUpdate` sets `PlacementFlags.OwnerSide`; the snapping
  is `ObjectToolSystem`'s `SnapJob`, under `Snap.OwnerSide`.
- non-zero — also gets `PlacementFlags.RoadSide` and may sit away from the parent,
  inside a region sized from `m_MaxPlacementDistance` and the parent's lot depth
  (`BuildingUtils.CalculateUpgradeRangeValues`).
- `m_MaxPlacementOffset` overrides how far along the edge it may slide, in the same
  `SnapJob`.

## Cost

`BuildingInitializeSystem.OnUpdate` overwrites
`PlaceableObjectData.m_ConstructionCost` with `ServiceUpgradeData.m_UpgradeCost`.
`GenerateObjectsSystem`'s `CreateObjectsJob` falls back to `m_UpgradeCost` directly
for upgrades that are not placeable objects. A game mode can scale it
(`ServiceUpgradeGlobalMode`).

The overwrite reaches only upgrades that have `PlaceableObjectData`, and
`ServiceUpgrade.GetPrefabComponents` adds that component only when the prefab is a
`BuildingPrefab`. A `BuildingExtensionPrefab` annex has none; its cost is
`ServiceUpgradeData.m_UpgradeCost` alone. So a `PlaceableObjectData` read gives a
sub-building's cost and nothing for an annex, such as a school's Extension Wing, and
`PrefabFacts.Apply` falls back to `m_UpgradeCost` for it.

## Installing does two separate things

### It grants components to the parent

`ServiceUpgradeSystem`'s `UpgradeInstalled` collects
`IServiceUpgrade.GetUpgradeComponents` from every component on the upgrade prefab
and adds to the parent any it lacks. **41 components implement `IServiceUpgrade`**
— `Hospital`, `School`, `PowerPlant`, `Workplace`, `Pollution`, `ParkingFacility`,
`TransportStation` and most other service capabilities.

So an upgrade can give a building an ability it did not have at all, not merely a
bigger number. `UpgradeRemoved` recomputes the union of the parent's own prefab
plus all *remaining* installed upgrades and strips the difference.

### It combines statistics

`UpgradeUtils` walks the parent's `InstalledUpgrade` buffer and calls
`ICombineData<T>.Combine` per stat. **34 stat types implement it.** The rules are
per-field and not uniformly additive:

- `HospitalData.Combine` adds patient capacity, takes the larger top of the health
  range, and ORs the diseases treated.
- `SchoolData.Combine` takes the larger education level. It does not add them.
- `WorkplaceData.Combine` blends the evening-shift probability, weighted by each
  side's workers.

`PollutionData` has its own path (`CombinePollutionStats`) so a
`PollutionEmitModifier` on the upgrade instance applies before combining.

## Disabling

Every combine is skipped when
`BuildingUtils.CheckOption(installedUpgrade, BuildingOption.Inactive)` is true.
That is the toggle in `UpgradesSection.OnToggle` — it applies the
"Out of Service" policy to the extension. A disabled extension stays standing and
contributes nothing.

## Two parent links, used for different questions

- `Owner.m_Owner` on the upgrade instance is the simulation link.
  `ServiceUpgradeReferencesSystem` maintains the parent's `InstalledUpgrade`
  back-buffer from it; the serialization side's `InstalledUpgradeSystem` rebuilds it
  on load.
- `Attached.m_Parent` is what the UI uses to answer "I clicked an annex, whose is
  it?" — `GetUpgradable` in both `UpgradeMenuUISystem` and `UpgradesSection`.

## What the two UI surfaces show

They are different systems and answer different questions:

| | group | shows | system |
|---|---|---|---|
| Picker | `upgradeMenu` | what you *may* add — `BuildingUpgradeElement` then `BuildingModule`, both `UIObjectData`-filtered and sorted by `m_Priority`, in **one flat list** | `UpgradeMenuUISystem` |
| Built list | `UpgradesSection` | what is *already* attached, split into `extensions` (has `Extension`) vs `subBuildings`, with delete / relocate / focus / toggle | `UpgradesSection` |

Note the asymmetry: **vanilla draws the extension/sub-building distinction only in
the built list.** The picker deliberately flattens it. Any redesign that labels
groups in the picker is inventing a distinction at the wrong end of the pipeline.

Each picker row is written by `ToolbarUISystem.BindAsset`, which already supplies
`entity`, `name` (`prefab.name`), `priority`, `icon`, `dlc`, `theme`, `locked`,
`uiTag`, `highlight`, `unique`, `placed` and `constructionCost`.

"Already built" is not a per-prefab fact:
`UpgradeMenuUISystem.CheckExtensionBuiltStatus` requires `ForbidMultiple` — meaning
`BuildingExtensionData` present, or `ServiceUpgradeData.m_ForbidMultiple` — *and* a
`PrefabRef` match inside that instance's `InstalledUpgrade` buffer. The separate
city-wide case comes from `UniqueAssetTrackingSystem`.

## Implications for this mod

1. **An annex's cost comes from `ServiceUpgradeData`** (see Cost above); a
   sub-building's comes from `PlaceableObjectData` like any other building.
2. **A prefab's own figures are not its contribution.** The hover card shows
   per-prefab stats; what an upgrade actually does to the parent is decided by
   `Combine`. Additive fields read naturally as "+300 patients"; a max field like
   education level would be actively misleading shown the same way.
3. **The thing vanilla cannot tell you** is what an upgrade *grants* — which
   `IServiceUpgrade` components the parent does not already have. That is the
   "what does this do for me" question the icon grid answers with a picture.
