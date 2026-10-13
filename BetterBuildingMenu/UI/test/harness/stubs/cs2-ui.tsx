import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

type Any = Record<string, unknown>;
const dataAndAria = (props: Any): Any =>
  Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith("data-") || k.startsWith("aria-")));

/** How many times a body's cell has drawn: a cell is a Button naming its building. Tests set it back. */
export const cellsDrawn = { count: 0 };

// The pointer's enter and leave reach the element, as the game's Button passes them on.
export const Button = ({ children, className, title, style, onSelect, disabled, src, onMouseEnter, onMouseLeave, ...rest }: Any & { children?: ReactNode; style?: CSSProperties }) => {
  if (rest["data-catalog-entry"] !== undefined) cellsDrawn.count += 1;
  return (
    <button
      className={className as string}
      title={title as string}
      style={style}
      disabled={disabled as boolean}
      data-has-select={onSelect ? "true" : undefined}
      data-src={src as string | undefined}
      onMouseEnter={onMouseEnter as MouseEventHandler | undefined}
      onMouseLeave={onMouseLeave as MouseEventHandler | undefined}
      {...dataAndAria(rest)}
    >
      {children}
    </button>
  );
};
export const Scrollable = ({ children, className, style }: Any & { children?: ReactNode; style?: CSSProperties }) => (
  <div className={className as string} style={style} data-scrollable="true">{children}</div>
);
// The card's content renders beside its anchor, so a test can assert on it.
export const Tooltip = ({ children, tooltip }: { children?: ReactNode; tooltip?: ReactNode }) => (
  <>{children}{tooltip !== undefined && tooltip !== null && <div data-tooltip="true">{tooltip}</div>}</>
);
export const Dropdown = ({ children, content }: { children?: ReactNode; content?: ReactNode }) => <div data-dropdown="true">{children}{content}</div>;
export const DropdownToggle = ({ children, className }: Any & { children?: ReactNode }) => <div className={className as string}>{children}</div>;
export const DropdownItem = ({ children, className }: Any & { children?: ReactNode }) => <div className={className as string}>{children}</div>;
export const Panel = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
export const PanelSection = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
