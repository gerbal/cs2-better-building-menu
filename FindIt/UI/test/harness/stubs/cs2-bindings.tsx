import { bindValue } from "./cs2-api";
export type Theme = Record<string, string>;
export type FocusKey = string; export type UniqueFocusKey = string; export type PrefabRequirement = unknown;
export const game = { activeGamePanel$: bindValue<unknown>("game", "activeGamePanel", null), GamePanelType: { PhotoMode: "Game.UI.InGame.PhotoModePanel" } };
export const tool = { activeTool$: bindValue<unknown>("tool", "activeTool", null) };
