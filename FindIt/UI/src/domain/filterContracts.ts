export interface FilterOptionState {
  selected: boolean;
  disabled: boolean;
  interactive: boolean;
}

export function getFilterOptionState(selected: boolean, disabled: boolean): FilterOptionState {
  return {
    selected: selected && !disabled,
    disabled,
    interactive: !disabled,
  };
}
