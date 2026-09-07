# How vanilla handles building upgrades and extensions

Read off the decompiled source on 2026-09-06, against the mod's own census of a
loaded save. Written because the mod's extension work kept tripping over
assumptions about this machinery that turned out to be wrong; every claim below
names the file it came from so a future reader can re-check rather than re-guess.

Paths are relative to `_decompiled/Game/Game/` in the workspace.

## Vocabulary

Four distinct things share the word "upgrade":

| Thing | What it is | Where |
|---|---|---|
| `ServiceUpgrade` (authoring) | A component declaring "this prefab can be attached to those buildings", with cost, XP and placement rules | `Prefabs/ServiceUpgrade.cs` |
| `BuildingExtensionPrefab` | A `StaticObjectPrefab` that is a physical annex — position, lot size, external flag | `Prefabs/BuildingExtensionPrefab.cs` |
| `BuildingModules` | A separate list of modules a modular building takes | `Prefabs/BuildingModules.cs` |
| `NetUpgrade` | Road-piece upgrades (lights, trees). Unrelated to buildings | `Prefabs/NetUpgrade.cs` |

The first two **compose**: an extension prefab carrying `ServiceUpgrade` is both
an annex and an upgrade. A plain `BuildingPrefab` carrying `ServiceUpgrade` is an
upgrade that is a whole building — vanilla calls that a *sub-building*.

## The link is authored backwards

Nothing on a building lists its upgrades. The relationship is declared on the
**upgrade**, pointing at buildings, and inverted at load:

1. `ServiceUpgrade.LateInitialize` fills the upgrade prefab's
   `ServiceUpgradeBuilding` buffer from `m_Buildings`, and calls
   `BuildingPrefab.AddUpgrade`, which only *creates* an empty
   `BuildingUpgradeElement` buffer on the building (`Prefabs/BuildingPrefab.cs:81-96`).
2. `BuildingInitializeSystem.cs:1207` walks every upgrade's
   `ServiceUpgradeBuilding` buffer and pushes a `BuildingUpgradeElement` onto each
   building it names. Removal at `:824` is symmetric.

This is why a mod can attach an upgrade to a vanilla building without editing it.

## Placement

`ServiceUpgradeData` carries two constraints:

- `m_MaxPlacementDistance == 0` — must snap to the parent's lot edge.
  `BuildingInitializeSystem.cs:1091` sets `PlacementFlags.OwnerSide`; the snapping
  is `ObjectToolSystem.cs:1088-1120` under `Snap.OwnerSide`.
- non-zero — also gets `PlacementFlags.RoadSide` and may sit away from the parent,
  inside a region sized `m_MaxPlacementDistance + lotSize.y * 8f`
  (`Buildings/BuildingUtils.cs:722`).
- `m_MaxPlacementOffset` overrides how far along the edge it may slide
  (`ObjectToolSystem.cs:1112`).

## Cost

`BuildingInitializeSystem.cs:1120` overwrites
`PlaceableObjectData.m_ConstructionCost` with `ServiceUpgradeData.m_UpgradeCost`.
`GenerateObjectsSystem.cs:1005` falls back to `m_UpgradeCost` directly only for
upgrades that are not placeable objects (nets, routes). A game mode can scale it
(`Prefabs/Modes/ServiceUpgradeGlobalMode.cs:28`).

**Consequence for this mod — corrected 2026-09-07 after a live check:** the
overwrite above only happens for upgrades that HAVE `PlaceableObjectData`, and
`ServiceUpgrade.GetPrefabComponents` adds that component only when the prefab
is a `BuildingPrefab` (`Prefabs/ServiceUpgrade.cs:46-50`). A
`BuildingExtensionPrefab` annex has no `PlaceableObjectData`; its cost lives only
in `ServiceUpgradeData.m_UpgradeCost`, which is the `GenerateObjectsSystem`
fallback path. So the indexer's `PlaceableObjectData` read is right for
sub-buildings and empty for annexes — a school's Extension Wing showed "—"
where vanilla shows ¢22,500 — and needs the `ServiceUpgradeData` fallback.

## Installing does two separate things

### It grants components to the parent

`Buildings/ServiceUpgradeSystem.cs` — `UpgradeInstalled` collects
`IServiceUpgrade.GetUpgradeComponents` from every component on the upgrade prefab
and adds to the parent any it lacks. **41 components implement `IServiceUpgrade`**
— `Hospital`, `School`, `PowerPlant`, `Workplace`, `Pollution`, `ParkingFacility`,
`TransportStation` and most other service capabilities.

So an upgrade can give a building an ability it did not have at all, not merely a
bigger number. `UpgradeRemoved` recomputes the union of the parent's own prefab
plus all *remaining* installed upgrades and strips the difference.

### It combines statistics

`Prefabs/UpgradeUtils.cs` walks the parent's `InstalledUpgrade` buffer and calls
`ICombineData<T>.Combine` per stat. **32 stat types implement it.** The rules are
per-field and not uniformly additive:

```csharp
// HospitalData.cs:25
m_PatientCapacity += otherData.m_PatientCapacity;            // additive
m_HealthRange.y    = math.max(m_HealthRange.y, otherData...); // max
m_TreatDiseases   |= otherData.m_TreatDiseases;              // OR

// SchoolData.cs:22 — max, NOT sum
m_EducationLevel = (byte)math.max((int)m_EducationLevel, (int)otherData.m_EducationLevel);

// WorkplaceData.cs:29 — weighted by worker count
m_EveningShiftProbability = math.lerp(other, mine, maxWorkers / m_MaxWorkers);
```

`PollutionData` has its own path (`CombinePollutionStats`) so a
`PollutionEmitModifier` on the upgrade instance applies before combining.

## Disabling

Every combine is skipped when
`BuildingUtils.CheckOption(installedUpgrade, BuildingOption.Inactive)` is true.
That is the toggle in `UI/InGame/UpgradesSection.cs:77` — it applies the
"Out of Service" policy to the extension. A disabled extension stays standing and
contributes nothing.

## Two parent links, used for different questions

- `Owner.m_Owner` on the upgrade instance is the simulation link.
  `Buildings/ServiceUpgradeReferencesSystem.cs:64` maintains the parent's
  `InstalledUpgrade` back-buffer from it; `Serialization/InstalledUpgradeSystem.cs:66`
  rebuilds it on load.
- `Attached.m_Parent` is what the UI uses to answer "I clicked an annex, whose is
  it?" — `UpgradeMenuUISystem.cs:255` and identically in `UpgradesSection.cs:130`.

## What the two UI surfaces show

They are different systems and answer different questions:

| | group | shows | file |
|---|---|---|---|
| Picker | `upgradeMenu` | what you *may* add — `BuildingUpgradeElement` then `BuildingModule`, both `UIObjectData`-filtered and sorted by `m_Priority`, in **one flat list** | `UI/InGame/UpgradeMenuUISystem.cs` |
| Built list | `UpgradesSection` | what is *already* attached, split into `extensions` (has `Extension`) vs `subBuildings`, with delete / relocate / focus / toggle | `UI/InGame/UpgradesSection.cs` |

Note the asymmetry: **vanilla draws the extension/sub-building distinction only in
the built list.** The picker deliberately flattens it. Any redesign that labels
groups in the picker is inventing a distinction at the wrong end of the pipeline.

Each picker row is written by `ToolbarUISystem.BindAsset`
(`UI/InGame/ToolbarUISystem.cs:375-441`), which already supplies `entity`, `name`
(`prefab.name`), `priority`, `icon`, `dlc`, `theme`, `locked`, `uiTag`,
`highlight`, `unique`, `placed` and `constructionCost`.

"Already built" is not a per-prefab fact: `CheckExtensionBuiltStatus`
(`UpgradeMenuUISystem.cs:346`) requires `ForbidMultiple` — meaning
`BuildingExtensionData` present, or `ServiceUpgradeData.m_ForbidMultiple` — *and* a
`PrefabRef` match inside that instance's `InstalledUpgrade` buffer. The separate
city-wide case comes from `UniqueAssetTrackingSystem`.

## Measured, not assumed

Census run 2026-09-06 on the dev save, prefix `949230-b`, via a throwaway pass in
`PrefabIndexingSystem` over every entity carrying either buffer (17,582 prefabs
indexed):

```
hosts: upgrades=72 modules=0 both=0 total=72
drawn rows: upgrades=161 modules=0 maxPerHost=4
histogram: 0rows x1, 1rows x15, 2rows x27, 3rows x24, 4rows x5
examples: PoliceStation01:1/1 | Harbor01:2/2 | GeothermalPowerPlant01:3/3 |
          Crematorium01:3/3 | University01:3/3 | TrainStationTerminus01:4/4
```

- 72 of 17,582 prefabs offer upgrades. Median list length 2, maximum 4.
- The `UIObjectData` filter changes the outcome for exactly one host (`0rows x1`).
- **No entity carried a `BuildingModule` buffer at all.** The query matched `Any`
  of the two buffers and returned exactly the 72 upgrade hosts.

### Open question

`PrefabIndexingSystem.GetSupportedUpgrades`'s comment states that signature towers
are module-based, and that reading only the `ServiceUpgrade` side made "every
signature report no upgrades at all". The census contradicts that: this install
has no module buffers. Either the comment is stale, the towers are DLC content
absent here, or the census query missed them. Unresolved — do not rely on either
account without re-measuring.

## Implications for this mod

1. **Cost needs no special handling** (see above).
2. **A prefab's own figures are not its contribution.** The hover card shows
   per-prefab stats; what an upgrade actually does to the parent is decided by
   `Combine`. Additive fields read naturally as "+300 patients"; a max field like
   education level would be actively misleading shown the same way.
3. **The thing vanilla cannot tell you** is what an upgrade *grants* — which
   `IServiceUpgrade` components the parent does not already have. That is the
   "what does this do for me" question the icon grid answers with a picture.
