import { bindValue, bindMap, triggers } from "./cs2-api";
export type Theme = Record<string, string>;
export type FocusKey = string; export type UniqueFocusKey = string; export type PrefabRequirement = unknown;
export const game = { activeGamePanel$: bindValue<unknown>("game", "activeGamePanel", null), GamePanelType: { PhotoMode: "Game.UI.InGame.PhotoModePanel" } };
export const tool = { activeTool$: bindValue<unknown>("tool", "activeTool", null) };

// The selected-info panel and the upgrade picker, as the typed cs2/bindings
// package exports them. Entities are {index, version}; Entity.Null is 0:0.
export interface Entity { index: number; version: number }
export const selectedInfo = {
  selectedEntity$: bindValue<Entity>("selectedInfo", "selectedEntity", { index: 0, version: 0 }),
};
export const upgrade = {
  upgrades$: bindMap<Entity, unknown[]>("upgradeMenu", "upgrades"),
  selectedUpgrade$: bindValue<Entity>("upgradeMenu", "selectedUpgrade", { index: 0, version: 0 }),
  upgrading$: bindValue<boolean>("upgradeMenu", "upgrading", false),
  selectUpgrade: (entity: Entity, upgradeEntity: Entity): void => { triggers.push({ group: "upgradeMenu", name: "selectUpgrade", args: [entity, upgradeEntity] }); },
  clearUpgradeSelection: (): void => { triggers.push({ group: "upgradeMenu", name: "clearUpgradeSelection", args: [] }); },
};
