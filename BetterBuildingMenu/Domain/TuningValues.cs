using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>What the UI reads of the developer knobs: whether this run is in developer mode, and each knob it uses, resolved.</summary>
	/// <remarks>
	/// Resolved in C# through the one rule every knob is read by, so a value stored for tuning does
	/// nothing in a normal run on the UI's side either. See docs/design-notes.md, "Developer knobs".
	/// </remarks>
	public sealed record TuningValues(
		bool DeveloperMode,
		bool InterfaceStyles,
		bool TabNames,
		int ListShare = Tuning.ListShare,
		string WhatCounts = Tuning.WhatCounts,
		string AutoLargeText = Tuning.AutoLargeText,
		int CardsFrom = Tuning.CardsFrom,
		float ListPlateHeight = Tuning.ListPlateHeight,
		int NameLines = Tuning.NameLines,
		bool TileNameLine = Tuning.TileNameLine,
		string BlockLabels = Tuning.BlockLabels,
		int CardHeight = Tuning.CardHeight,
		bool SmallMenusGrow = Tuning.SmallMenusGrow,
		string SearchFlow = Tuning.SearchFlow,
		bool DimTypedWord = Tuning.DimTypedWord,
		int IconsAbove = Tuning.IconsAbove,
		int IconSize = Tuning.IconSize,
		int HoverDelay = Tuning.HoverDelay) : IJsonWritable
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
			writer.PropertyName("listShare");
			writer.Write(ListShare);
			writer.PropertyName("whatCounts");
			writer.Write(WhatCounts);
			writer.PropertyName("autoLargeText");
			writer.Write(AutoLargeText);
			writer.PropertyName("cardsFrom");
			writer.Write(CardsFrom);
			writer.PropertyName("listPlateHeight");
			writer.Write(ListPlateHeight);
			writer.PropertyName("nameLines");
			writer.Write(NameLines);
			writer.PropertyName("tileNameLine");
			writer.Write(TileNameLine);
			writer.PropertyName("blockLabels");
			writer.Write(BlockLabels);
			writer.PropertyName("cardHeight");
			writer.Write(CardHeight);
			writer.PropertyName("smallMenusGrow");
			writer.Write(SmallMenusGrow);
			writer.PropertyName("searchFlow");
			writer.Write(SearchFlow);
			writer.PropertyName("dimTypedWord");
			writer.Write(DimTypedWord);
			writer.PropertyName("iconsAbove");
			writer.Write(IconsAbove);
			writer.PropertyName("iconSize");
			writer.Write(IconSize);
			writer.PropertyName("hoverDelay");
			writer.Write(HoverDelay);
			writer.TypeEnd();
		}
	}
}
