import { bindValue, useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import mod from "../../../mod.json";
import type { BuildingCatalogPage } from "domain/buildingCatalog";
import styles from "./lensControlPane.module.scss";

const BuildingCatalog$ = bindValue<BuildingCatalogPage>(mod.id, "BuildingCatalog");

/**
 * What the pane takes out of the panel's width: its own 379rem plus the 6rem
 * gap in lensControlPane.module.scss.
 *
 * 379rem, not 253rem. The target is vanilla's tool-side-column, measured at
 * 253 PIXELS, and 1rem is 0.6667px here. Written as 253rem it would draw at
 * two thirds the width and look nearly right — the same units slip that hid in
 * BuildingLensTileSize and in lensToolOptions' row height.
 */
export const LENS_CONTROL_PANE_TOTAL = 385;

/**
 * The Building Lens control plane.
 *
 * A column to the right of the build menu, mirroring vanilla's tool-options
 * column on the left. The dividing line between the two is what they act on,
 * not who owns them: the left bank holds everything that narrows the set —
 * vanilla's Theme, our filter rail, the active-filter chips — and this pane
 * holds everything that decides how the qualifying set is presented.
 *
 * That line matters because Theme is a filter. Splitting on ownership instead
 * would have put our rail here and left a control doing the same job on the
 * far side of the screen.
 *
 * Why a pane at all: these controls used to live in a band inside the panel
 * that rendered only when it was expanded, so at the strip height the lens
 * rests at there was no count, no sort, no grouping and no view switch at all.
 */
export const LensControlPane = () => {
  const { translate } = useLocalization();
  const page = useValue(BuildingCatalog$);
  const totalCount = page?.totalCount ?? 0;

  return (
    <div className={styles.pane}>
      <div className={styles.row}>
        <span className={styles.count}>{totalCount.toLocaleString()}</span>
        <span className={styles.countUnit}>
          {translate("Tooltip.LABEL[FindItBuildingMenu.Buildings]", "buildings")}
        </span>
      </div>
    </div>
  );
};
