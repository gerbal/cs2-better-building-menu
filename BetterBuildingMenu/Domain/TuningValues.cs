using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>What the UI reads of the developer knobs: whether this run is in developer mode, and each knob it uses, resolved.</summary>
	/// <remarks>
	/// Resolved in C# through the one rule every knob is read by, so a value stored for tuning does
	/// nothing in a normal run on the UI's side either. See docs/design-notes.md, "Developer knobs".
	/// </remarks>
	public sealed record TuningValues(bool DeveloperMode, bool InterfaceStyles, bool TabNames) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("developerMode");
			writer.Write(DeveloperMode);
			writer.PropertyName("interfaceStyles");
			writer.Write(InterfaceStyles);
			writer.PropertyName("tabNames");
			writer.Write(TabNames);
			writer.TypeEnd();
		}
	}
}
