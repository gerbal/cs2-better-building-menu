using Game.Net;

namespace BetterBuildingMenu.Domain
{
	/// <summary>The voltage a network or a building connects at, as vanilla's tooltip words it.</summary>
	/// <remarks>ElectricityUIUtils, transcribed.</remarks>
	public static class PowerLineVoltage
	{
		private const Layer PowerLines = Layer.PowerlineLow | Layer.PowerlineHigh;

		/// <summary>Whether the layers hold a power line of either voltage.</summary>
		public static bool Carries(Layer layers) => (layers & PowerLines) != 0;

		/// <summary>"Low", "High" or "Both".</summary>
		/// <remarks>Anything but one voltage alone is "Both", no power line at all included, as
		/// GetVoltage has it.</remarks>
		public static string Of(Layer layers) =>
			(layers & PowerLines) switch
			{
				Layer.PowerlineLow => "Low",
				Layer.PowerlineHigh => "High",
				_ => "Both",
			};
	}
}
