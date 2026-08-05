export type ToolSurfaceAction = "NativeAssetMenu" | "NativeAssetCategory" | "NativeTool" | "Unavailable";

export interface ToolSurfaceDescriptor {
  id: string;
  icon: string;
  toolTip: string;
  action: ToolSurfaceAction;
  aliases: string[];
}

export interface ToolbarEntityRef {
  index: number;
  version?: number;
}

export type ToolbarEntity = number | string | ToolbarEntityRef;

export interface ToolbarItem {
  entity: ToolbarEntity;
  name?: string;
  uiTag?: string;
  type?: number | string;
  icon?: string;
  locked?: boolean;
  children?: ToolbarItem[];
}

export interface ToolbarGroup {
  entity?: ToolbarEntity;
  children?: ToolbarItem[];
}

export type ToolbarCategorySource =
  | Map<ToolbarEntity, ToolbarItem[] | ToolbarItem>
  | Record<string, ToolbarItem[] | ToolbarItem>
  | Array<ToolbarItem | { entity?: ToolbarEntity; children?: ToolbarItem[] }>;

export type ToolbarTrigger = "selectAssetMenu" | "selectAssetCategory";

export interface ToolSurfaceTarget {
  trigger: ToolbarTrigger;
  entity: ToolbarEntity;
  alias: string;
}

export interface ToolSurfaceResolution {
  descriptor: ToolSurfaceDescriptor;
  enabled: boolean;
  reason: string;
  target?: ToolSurfaceTarget;
}

export interface ToolSurfaceHandoffCommand {
  group: "toolbar" | "mod";
  method: string;
  args: unknown[];
}

export interface ToolSurfaceHandoff {
  toolbar: ToolSurfaceHandoffCommand;
  afterToolbar: ToolSurfaceHandoffCommand[];
}

export interface ToolSurfaceRenderModel extends ToolSurfaceDescriptor {
  surfaceKind: "tools";
  enabled: boolean;
  reason: string;
  target?: ToolSurfaceTarget;
}

export function normalizeToolSurfaceText(value: string): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenItems(items: ToolbarItem[] | undefined): ToolbarItem[] {
  if (!items) return [];

  const flattened: ToolbarItem[] = [];
  for (const item of items) {
    flattened.push(item);
    if (item.children) flattened.push(...flattenItems(item.children));
  }
  return flattened;
}

function collectToolbarItems(groups: ToolbarGroup[] | undefined): ToolbarItem[] {
  if (!groups) return [];
  return groups.flatMap((group) => flattenItems(group.children));
}

function collectCategoryItems(source: ToolbarCategorySource | undefined): ToolbarItem[] {
  if (!source) return [];

  if (source instanceof Map) {
    return Array.from(source.values()).flatMap((value) =>
      Array.isArray(value) ? flattenItems(value) : flattenItems([value])
    );
  }

  if (Array.isArray(source)) {
    return source.flatMap((value) => {
      if ("children" in value && value.children) return flattenItems(value.children);
      return flattenItems([value as ToolbarItem]);
    });
  }

  return Object.values(source).flatMap((value) =>
    Array.isArray(value) ? flattenItems(value) : flattenItems([value])
  );
}

function uniqueItems(items: ToolbarItem[]): ToolbarItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = toolbarEntityKey(item.entity);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toolbarEntityKey(entity: ToolbarEntity): string {
  if (typeof entity === "object" && entity !== null) {
    return `entity:${entity.index}:${entity.version ?? ""}`;
  }

  return `${typeof entity}:${String(entity)}`;
}

function findAliasMatches(descriptor: ToolSurfaceDescriptor, items: ToolbarItem[]): { matches: ToolbarItem[]; alias: string } {
  const aliases = descriptor.aliases
    .map((alias) => ({ raw: alias, normalized: normalizeToolSurfaceText(alias) }))
    .filter((alias) => alias.normalized.length > 0);

  const uiTagMatches = uniqueItems(
    items.filter((item) => aliases.some((alias) => normalizeToolSurfaceText(item.uiTag ?? "") === alias.normalized))
  );
  if (uiTagMatches.length > 0) {
    const firstAlias = aliases.find((alias) =>
      uiTagMatches.some((item) => normalizeToolSurfaceText(item.uiTag ?? "") === alias.normalized)
    );
    return { matches: uiTagMatches, alias: firstAlias?.raw ?? "" };
  }

  const nameMatches = uniqueItems(
    items.filter((item) => aliases.some((alias) => normalizeToolSurfaceText(item.name ?? "") === alias.normalized))
  );
  if (nameMatches.length > 0) {
    const firstAlias = aliases.find((alias) =>
      nameMatches.some((item) => normalizeToolSurfaceText(item.name ?? "") === alias.normalized)
    );
    return { matches: nameMatches, alias: firstAlias?.raw ?? "" };
  }

  return { matches: [], alias: "" };
}

export function resolveToolSurfaceTarget(
  descriptor: ToolSurfaceDescriptor,
  toolbarGroups: ToolbarGroup[] | undefined,
  assetCategories: ToolbarCategorySource | undefined
): ToolSurfaceResolution {
  if (descriptor.action === "NativeTool") {
    return {
      descriptor,
      enabled: false,
      reason: "The native tool trigger is not exposed by the toolbar binding yet.",
    };
  }

  if (descriptor.action === "Unavailable") {
    return { descriptor, enabled: false, reason: "This construction surface is not available." };
  }

  const candidates = descriptor.action === "NativeAssetMenu"
    ? collectToolbarItems(toolbarGroups)
    : collectCategoryItems(assetCategories);
  if (candidates.length === 0) {
    return {
      descriptor,
      enabled: false,
      reason: "The vanilla toolbar is not ready; no matching target is available.",
    };
  }

  const { matches, alias } = findAliasMatches(descriptor, candidates);
  if (matches.length === 0) {
    return { descriptor, enabled: false, reason: "No matching native toolbar target was found." };
  }

  const unlockedMatches = matches.filter((item) => !item.locked);
  if (unlockedMatches.length === 0) {
    return { descriptor, enabled: false, reason: "The matching native toolbar target is locked." };
  }

  if (unlockedMatches.length > 1) {
    return { descriptor, enabled: false, reason: "Ambiguous native toolbar target: multiple matches were found." };
  }

  const match = unlockedMatches[0];

  return {
    descriptor,
    enabled: true,
    reason: "Ready",
    target: {
      trigger: descriptor.action === "NativeAssetMenu" ? "selectAssetMenu" : "selectAssetCategory",
      entity: match.entity,
      alias,
    },
  };
}

export function getToolSurfaceAvailability(resolution: ToolSurfaceResolution): { enabled: boolean; reason: string } {
  return { enabled: resolution.enabled, reason: resolution.reason };
}

export function buildToolSurfaceHandoff(resolution: ToolSurfaceResolution): ToolSurfaceHandoff | null {
  if (!resolution.enabled || !resolution.target) return null;

  return {
    toolbar: {
      group: "toolbar",
      method: resolution.target.trigger,
      args: [resolution.target.entity],
    },
    afterToolbar: [
      { group: "mod", method: "SetBuildingLensEnabled", args: [false] },
      { group: "mod", method: "FindItCloseToggled", args: [] },
    ],
  };
}

export function buildToolSurfaceRenderModel(
  descriptors: ToolSurfaceDescriptor[],
  toolbarGroups: ToolbarGroup[] | undefined,
  assetCategories: ToolbarCategorySource | undefined
): ToolSurfaceRenderModel[] {
  return descriptors.map((descriptor) => {
    const resolution = resolveToolSurfaceTarget(descriptor, toolbarGroups, assetCategories);
    return {
      ...descriptor,
      surfaceKind: "tools",
      enabled: resolution.enabled,
      reason: resolution.reason,
      target: resolution.target,
    };
  });
}
