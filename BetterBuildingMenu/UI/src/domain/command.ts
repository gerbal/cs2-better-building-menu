/** A command to the mod's C# side: the trigger's name and its arguments. */
export interface Command {
  method: string;
  args: readonly unknown[];
}
