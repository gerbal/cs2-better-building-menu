import type { ReactNode, CSSProperties } from "react";

type Any = Record<string, unknown>;
const dataAndAria = (props: Any): Any =>
  Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith("data-") || k.startsWith("aria-")));

export const Button = ({ children, className, title, style, onSelect, disabled, ...rest }: Any & { children?: ReactNode; style?: CSSProperties }) => (
  <button className={className as string} title={title as string} style={style} disabled={disabled as boolean} data-has-select={onSelect ? "true" : undefined} {...dataAndAria(rest)}>
    {children}
  </button>
);
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
