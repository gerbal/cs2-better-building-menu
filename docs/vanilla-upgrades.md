# How vanilla handles building upgrades and extensions

How the game's upgrade machinery works, as far as the mod's extension picker and hover card
rely on it. It names the game's types and members, to be read in a decompilation of
`Game.dll`.

## Vocabulary

Four distinct things share the word "upgrade":

| Thing | What it is |
|---|---|
| `ServiceUpgrade` (authoring) | A component declaring "this prefab can be attached to those buildings", with cost, XP and placement rules |
| `BuildingExtensionPrefab` | A `StaticObjectPrefab` that is a physical annex — position, lot size, external flag |
| `BuildingModules` | A separate list of modules a modular building takes |
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

## What installing an upgrade does

Installing an upgrade does two separate things to its parent:

- **It can grant the parent new abilities.** `ServiceUpgradeSystem`'s `UpgradeInstalled` adds
  to the parent every `IServiceUpgrade.GetUpgradeComponents` component it lacks, such as
  `Hospital`, `School`, `PowerPlant` or `ParkingFacility`. So an upgrade can give a building
  something it did not do at all, not merely a bigger number. `UpgradeRemoved` takes back
  whatever neither the parent's own prefab nor a remaining upgrade provides.
- **It combines statistics, field by field.** `UpgradeUtils` walks the parent's
  `InstalledUpgrade` buffer and calls `ICombineData<T>.Combine` per stat, and the rules are
  not uniformly additive. `HospitalData.Combine` adds patient capacity but takes the larger
  top of the health range; `SchoolData.Combine` takes the larger education level rather than
  adding them.

An upgrade switched off in the building's panel (`UpgradesSection.OnToggle`, which applies
the "Out of Service" policy to it) stays standing and contributes nothing.

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

**Vanilla draws the extension/sub-building distinction only in the built list.** The
picker flattens it, so grouping the picker by that distinction would be inventing one the
game does not make there.

Each picker row is written by `ToolbarUISystem.BindAsset`, which already supplies
`entity`, `name` (`prefab.name`), `priority`, `icon`, `dlc`, `theme`, `locked`,
`uiTag`, `highlight`, `unique`, `placed` and `constructionCost`.

"Already built" is not a per-prefab fact:
`UpgradeMenuUISystem.CheckExtensionBuiltStatus` requires `ForbidMultiple` — meaning
`BuildingExtensionData` present, or `ServiceUpgradeData.m_ForbidMultiple` — *and* a
`PrefabRef` match inside that instance's `InstalledUpgrade` buffer. The separate
city-wide case comes from `UniqueAssetTrackingSystem`.

## Implications for this mod

1. **An annex's cost comes from `ServiceUpgradeData`** (see "Cost"); a
   sub-building's comes from `PlaceableObjectData` like any other building.
2. **A prefab's own figures are not its contribution.** The hover card shows
   per-prefab figures; what an upgrade actually does to its parent is decided by
   `Combine`. An additive field reads naturally as "+300 patients", but a field
   the game takes the larger of, such as education level, would mislead shown
   the same way.
3. **The game's own UI never shows what an upgrade grants**, that is, which
   `IServiceUpgrade` components the parent does not already have.
