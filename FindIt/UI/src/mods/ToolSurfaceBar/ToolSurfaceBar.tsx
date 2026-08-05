import { bindMap, bindValue, trigger, useMapValues, useValue } from "cs2/api";
import { useMemo } from "react";
import { useLocalization } from "cs2/l10n";
import mod from "../../../mod.json";
import { BasicButton } from "mods/BasicButton/BasicButton";
import {
  buildToolSurfaceHandoff,
  buildToolSurfaceRenderModel,
  type ToolSurfaceDescriptor,
  type ToolbarCategorySource,
  type ToolbarEntity,
  type ToolbarEntityRef,
  type ToolbarGroup,
  type ToolbarItem,
} from "domain/toolSurfaceContracts";
import styles from "./toolSurfaceBar.module.scss";

const ToolSurfaceDescriptors$ = bindValue<ToolSurfaceDescriptor[]>(mod.id, "ToolSurfaceDescriptors", []);
const ToolbarGroups$ = bindValue<ToolbarGroup[]>("toolbar", "toolbarGroups", []);
const AssetCategories$ = bindMap<ToolbarEntityRef, ToolbarItem[]>("toolbar", "assetCategories");

function isToolbarEntityRef(entity: ToolbarEntity): entity is ToolbarEntityRef {
  return typeof entity === "object" && entity !== null && Number.isFinite(entity.index);
}

function collectToolbarMenuEntities(groups: ToolbarGroup[]): ToolbarEntityRef[] {
  const seen = new Set<string>();
  const entities: ToolbarEntityRef[] = [];
  const visit = (items: ToolbarItem[] | undefined): void => {
    for (const item of items ?? []) {
      if (isToolbarEntityRef(item.entity)) {
        const key = `${item.entity.index}:${item.entity.version ?? ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          entities.push(item.entity);
        }
      }
      visit(item.children);
    }
  };

  for (const group of groups) visit(group.children);
  return entities;
}

function localizedToolSurfaceLabel(
  translate: (key: string, fallback?: string | null) => string | null,
  toolTip: string
): string {
  return translate(`Tooltip.LABEL[FindItBuildingMenu.${toolTip}]`, toolTip) ?? toolTip;
}

export const ToolSurfaceBar = () => {
  const { translate } = useLocalization();
  const descriptors = useValue(ToolSurfaceDescriptors$) ?? [];
  const toolbarGroups = useValue(ToolbarGroups$) ?? [];
  const toolbarMenuEntities = useMemo(() => collectToolbarMenuEntities(toolbarGroups), [toolbarGroups]);
  const categoryValues = useMapValues(AssetCategories$, toolbarMenuEntities);
  const assetCategories = useMemo<ToolbarCategorySource>(
    () => categoryValues.flatMap((value) => value ?? []),
    [categoryValues]
  );
  const renderModel = buildToolSurfaceRenderModel(descriptors, toolbarGroups, assetCategories);

  function activateSurface(entry: (typeof renderModel)[number]): void {
    if (!entry.enabled) return;

    const handoff = buildToolSurfaceHandoff({
      descriptor: entry,
      enabled: entry.enabled,
      reason: entry.reason,
      target: entry.target,
    });
    if (!handoff) return;

    trigger(handoff.toolbar.group, handoff.toolbar.method, ...handoff.toolbar.args);
    for (const command of handoff.afterToolbar) {
      trigger(mod.id, command.method, ...command.args);
    }
  }

  return (
    <div className={styles.toolSurfaceBar} data-surface-kind="tools">
      <div className={styles.heading}>
        {translate("Tooltip.LABEL[FindItBuildingMenu.Tools]", "Construction tools")}
      </div>
      <div className={styles.items}>
        {renderModel.map((entry) => {
          const label = localizedToolSurfaceLabel(translate, entry.toolTip);
          const tooltip = entry.enabled ? label : `${label}: ${entry.reason}`;
          return (
            <BasicButton
              key={entry.id}
              tooltip={tooltip}
              src={entry.icon}
              text={label}
              disabled={!entry.enabled}
              onClick={entry.enabled ? () => activateSurface(entry) : undefined}
              className={styles.item}
            />
          );
        })}
      </div>
    </div>
  );
};
