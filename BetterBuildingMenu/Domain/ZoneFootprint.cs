using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One lot footprint a zone's spawnable buildings occupy.
	/// </summary>
	/// <remarks>
	/// A range answers roughly what fits; the distinct set answers exactly which
	/// shapes do, which is what the player matches against the block they are about
	/// to draw. A zone that grows 2x2 and 4x2 but never 3x2 is a real case.
	/// </remarks>
	public readonly record struct ZoneFootprint(int Width, int Depth) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("width");
			writer.Write(Width);
			writer.PropertyName("depth");
			writer.Write(Depth);
			writer.TypeEnd();
		}
	}
}
