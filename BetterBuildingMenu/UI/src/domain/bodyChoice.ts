/**
 * Which body a menu draws, strongest first: a typed search's, the menu's own VIEW pick, Default view
 * unless it is Auto, then the look's Auto rule over the menu's share. Pure, so every rule is a test;
 * C# keeps the picks and counts the shares. See docs/design-notes.md, "The bodies".
 */

/** The bodies, as C# stores a menu's own pick (BodyViews.Kinds). */
export const BODY_KINDS = ["list", "icons", "tiles", "cards"] as const;

export type BodyKind = (typeof BODY_KINDS)[number];

/** VIEW's rows after Default view, in their order: the bodies drawn. */
export const VIEW_ROWS: readonly BodyKind[] = BODY_KINDS;

/**
 * The icons with each name under its picture: a menu's pick C# hands over only in developer mode, for
 * the timed check against the icons, which draws the icons body.
 */
export const ICONS_NAMED = "iconsNamed";

/** What the Auto rule reads of one menu: its rows, and how many carry a cost or a capacity, a capacity, a lock (MenuShare.cs). */
export interface MenuShare {
  menu: string;
  rows: number;
  costOrCapacity: number;
  capacity: number;
  locked: number;
  /** The rows under each label the menu's All draws, in order; none where it draws no label. */
  groupRows?: number[];
  /** The tabs the menu's row draws over its whole menu. */
  tabs?: number;
}

/** The developer knobs the Auto rule reads, as AssetMenuTuning carries them; a missing one is its shipped value. */
export interface AutoKnobs {
  listShare?: number;
  whatCounts?: string;
  autoLargeText?: string;
  cardsFrom?: number;
  iconsAbove?: number;
}

/** The menus whose body the Auto at large text knob speaks for. */
export const LARGE_TEXT_MENUS: readonly string[] = ["Roads", "Parks & Recreation"];

/** Auto draws icons for a menu holding more rows than this, where too few carry what counts, as the Icons above knob ships. */
export const ICONS_ABOVE = 200;

const SHIPPED_LIST_SHARE = 50;

export function isBodyKind(value: unknown): value is BodyKind {
  return typeof value === "string" && (BODY_KINDS as readonly string[]).includes(value);
}

export interface AutoInput {
  /** The open menu's share, or nothing before C# has counted it. */
  share: MenuShare | null | undefined;
  textScale: number;
  /** The Width step the box draws. */
  step: number;
  knobs: AutoKnobs;
}

/**
 * Standard's Auto: a list where at least the List share of the menu's rows carry a cost or a capacity
 * (or a capacity only, by the What counts knob), icons for a big menu where fewer carry a cost or a
 * capacity, tiles otherwise. Never Cards, unless the Cards from width knob says from which step. Above 100% text
 * the Auto at large text knob can force Roads and Parks to the list or the tiles. A menu not yet counted
 * draws the list.
 */
export function autoBody({ share, textScale, step, knobs }: AutoInput): BodyKind {
  const cardsFrom = knobs.cardsFrom ?? 0;

  if (cardsFrom > 0 && step >= cardsFrom) {
    return "cards";
  }

  const forced = knobs.autoLargeText;

  if (textScale > 1 && share && LARGE_TEXT_MENUS.includes(share.menu) && (forced === "list" || forced === "tiles")) {
    return forced;
  }

  if (!share || share.rows <= 0) {
    return "list";
  }

  const listShare = knobs.listShare ?? SHIPPED_LIST_SHARE;
  const holds = (count: number): boolean => count * 100 >= listShare * share.rows;

  if (holds(knobs.whatCounts === "capacityOnly" ? share.capacity : share.costOrCapacity)) {
    return "list";
  }

  // A prop catalogue: big, and few of its rows have a cost or a capacity at all.
  return share.rows > (knobs.iconsAbove ?? ICONS_ABOVE) && !holds(share.costOrCapacity) ? "icons" : "tiles";
}

export interface BodyInput {
  /** Whether a query is typed in the box. */
  searching: boolean;
  /** The menu's own VIEW pick, or "" for none. */
  menuPick: string;
  /** Default view: "auto", or a body for every menu without a pick. */
  defaultView: string;
  /** What the look's Auto rule gives this menu. */
  auto: BodyKind;
}

/** The menu's view: its own pick, the icons for the icons with names, else Default view unless it is Auto, else Auto. */
export function menuView({ menuPick, defaultView, auto }: Omit<BodyInput, "searching">): BodyKind {
  const picked = menuPick === ICONS_NAMED ? "icons" : menuPick;

  return isBodyKind(picked) ? picked : isBodyKind(defaultView) ? defaultView : auto;
}

/** What the menu draws: its view, or while a query is typed the list, kept as Cards where its view is Cards. */
export function chooseBody(input: BodyInput): BodyKind {
  const view = menuView(input);

  return input.searching && view !== "cards" ? "list" : view;
}

/** Whether the icons draw each name under its picture: the menu's own pick says so, and no query is typed. */
export function namesIcons(menuPick: string, drawn: BodyKind): boolean {
  return menuPick === ICONS_NAMED && drawn === "icons";
}
