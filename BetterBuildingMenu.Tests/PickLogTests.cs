using BetterBuildingMenu.Domain.Placement;

using System.Globalization;
using System.Text.Json;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The pick log's lines: an arm and its source, a swap, a placement and what is around it, and
	/// each as one line of JSON.
	/// </summary>
	public sealed class PickLogTests
	{
		private static readonly PlacementKey SmallRoad = new("Roads", "Small Road");
		private static readonly PlacementKey MediumRoad = new("Roads", "Medium Road");
		private static readonly ScreenPoint Middle = new(960, 540);

		/// <summary>An event's line, read back as JSON, after checking it is one line.</summary>
		private static JsonElement Parsed(PickEvent pick)
		{
			var line = PickLogJson.Line(pick);

			Assert.DoesNotContain("\n", line);

			using var document = JsonDocument.Parse(line);

			return document.RootElement.Clone();
		}

		[Theory]
		[InlineData(5, 5, PickSource.Bbm)]
		[InlineData(5, 0, PickSource.Game)]
		[InlineData(5, 6, PickSource.Game)]
		[InlineData(0, 0, PickSource.Game)]
		public void AnArmIsBbmsOnlyWhenItIsThePrefabBbmAskedFor(int armed, int asked, PickSource source)
		{
			Assert.Equal(source, PickLog.SourceOf(armed, asked));
		}

		[Fact]
		public void AnArmIsOneLineWithItsSource()
		{
			Assert.Equal(
				new PickEvent[] { new PickArm(1.5, "Roads", "Small Road", PickSource.Bbm) },
				new PickLog().Armed(1.5, SmallRoad, PickSource.Bbm));
		}

		[Fact]
		public void TheSameBuildingStillArmedWritesNothing()
		{
			var log = new PickLog();
			log.Armed(1, SmallRoad, PickSource.Bbm);

			Assert.Empty(log.Armed(2, SmallRoad, PickSource.Game));
		}

		[Fact]
		public void AnArmThatReplacesABuildingNothingIsPlacedWithIsASwap()
		{
			var log = new PickLog();
			log.Armed(1, SmallRoad, PickSource.Bbm);

			Assert.Equal(
				new PickEvent[] { new PickArm(2, "Roads", "Medium Road", PickSource.Bbm), new PickSwap(2, "Roads", "Medium Road", "Small Road") },
				log.Armed(2, MediumRoad, PickSource.Bbm));
		}

		[Fact]
		public void AnArmAfterAPlacementIsNoSwap()
		{
			var log = new PickLog();
			log.Armed(1, SmallRoad, PickSource.Bbm);
			log.Placed(2, SmallRoad, Middle, BoxState.Open);

			Assert.Equal(new PickEvent[] { new PickArm(3, "Roads", "Medium Road", PickSource.Bbm) }, log.Armed(3, MediumRoad, PickSource.Bbm));
		}

		[Fact]
		public void AnArmAfterTheToolIsPutDownIsNoSwap()
		{
			var log = new PickLog();
			log.Armed(1, SmallRoad, PickSource.Bbm);

			Assert.Empty(log.Armed(2, null, PickSource.Game));
			Assert.Equal(new PickEvent[] { new PickArm(3, "Roads", "Medium Road", PickSource.Game) }, log.Armed(3, MediumRoad, PickSource.Game));
		}

		[Fact]
		public void APlacementCarriesWhereItIsTheBoxAndItsNumberSinceTheArm()
		{
			var log = new PickLog();
			log.Armed(1, SmallRoad, PickSource.Bbm);
			var aside = new ScreenPoint(100, 200);

			Assert.Equal(new PickPlace(2, "Roads", "Small Road", Middle, false, BoxState.Open, 0, 1), log.Placed(2, SmallRoad, Middle, BoxState.Open));
			Assert.Equal(new PickPlace(3, "Roads", "Small Road", aside, false, BoxState.Closed, 0, 2), log.Placed(3, SmallRoad, aside, BoxState.Closed));
		}

		[Fact]
		public void APlacementSaysWhetherTheCameraMovedSinceTheArm()
		{
			var log = new PickLog();
			log.Armed(1, SmallRoad, PickSource.Bbm);
			log.CameraMoved();

			Assert.True(log.Placed(2, SmallRoad, Middle, BoxState.Open).CameraMoved);
			// Since the arm, not since the placement before.
			Assert.True(log.Placed(3, SmallRoad, Middle, BoxState.Open).CameraMoved);

			log.Armed(4, MediumRoad, PickSource.Bbm);

			Assert.False(log.Placed(5, MediumRoad, Middle, BoxState.Open).CameraMoved);
		}

		[Fact]
		public void APlacementCountsTheTabSwitchesSinceThePreviousPlacement()
		{
			var log = new PickLog();
			log.Armed(1, SmallRoad, PickSource.Bbm);
			log.TabSwitched();
			log.TabSwitched();

			Assert.Equal(2, log.Placed(2, SmallRoad, Middle, BoxState.Open).TabSwitches);
			Assert.Equal(0, log.Placed(3, SmallRoad, Middle, BoxState.Open).TabSwitches);

			log.TabSwitched();

			Assert.Equal(1, log.Placed(4, SmallRoad, Middle, BoxState.Open).TabSwitches);
		}

		[Fact]
		public void APlacementWithNoArmSeenCountsFromOne()
		{
			// The knob turning on with a building already armed.
			Assert.Equal(1, new PickLog().Placed(1, SmallRoad, Middle, BoxState.Closed).SinceArm);
		}

		[Fact]
		public void AResetForgetsWhatIsArmedAndTheTabsSwitched()
		{
			var log = new PickLog();
			log.Armed(1, SmallRoad, PickSource.Bbm);
			log.TabSwitched();
			log.Reset();

			Assert.Equal(new PickEvent[] { new PickArm(2, "Roads", "Medium Road", PickSource.Game) }, log.Armed(2, MediumRoad, PickSource.Game));
			Assert.Equal(0, log.Placed(3, MediumRoad, Middle, BoxState.Open).TabSwitches);
		}

		[Theory]
		[InlineData(960f, 540f, 1080f, 960.0, 540.0)]
		[InlineData(1280f, 360f, 1440f, 960.0, 810.0)]
		[InlineData(0f, 0f, 720f, 0.0, 1080.0)]
		[InlineData(100f, 100f, 768f, 140.6, 939.4)]
		public void APointInPixelsBecomesRemFromTheTopLeft(float x, float y, float height, double remX, double remY)
		{
			// Unity counts pixels up from the bottom; a screen is 1,080 rem tall at any resolution.
			Assert.Equal(new ScreenPoint(remX, remY), ScreenPoint.FromPixels(x, y, height));
		}

		[Fact]
		public void AScreenWithNoHeightGivesTheTopLeft()
		{
			Assert.Equal(new ScreenPoint(0, 0), ScreenPoint.FromPixels(500, 500, 0));
		}

		[Fact]
		public void ACameraMovesOnlyPastItsTolerance()
		{
			var still = new CameraPose(100, 50, 200, 0, -0.6f, 0.8f);

			Assert.False(still.MovedFrom(still));
			Assert.False((still with { X = 100.005f }).MovedFrom(still));
			Assert.True((still with { X = 100.02f }).MovedFrom(still));
			Assert.True((still with { DirectionY = -0.6002f }).MovedFrom(still));
		}

		[Fact]
		public void AnArmsLineNamesItsSource()
		{
			var line = Parsed(new PickArm(12.346, "Roads", "Small Road", PickSource.Game));

			Assert.Equal(12.35, line.GetProperty("t").GetDouble());
			Assert.Equal("arm", line.GetProperty("event").GetString());
			Assert.Equal("Roads", line.GetProperty("menu").GetString());
			Assert.Equal("Small Road", line.GetProperty("prefab").GetString());
			Assert.Equal("game", line.GetProperty("source").GetString());
		}

		[Fact]
		public void ASwapsLineNamesWhatItReplaced()
		{
			var line = Parsed(new PickSwap(3, "Roads", "Medium Road", "Small Road"));

			Assert.Equal("swap", line.GetProperty("event").GetString());
			Assert.Equal("Medium Road", line.GetProperty("prefab").GetString());
			Assert.Equal("Small Road", line.GetProperty("from").GetString());
		}

		[Fact]
		public void APlacementsLineCarriesEveryField()
		{
			var line = Parsed(new PickPlace(20, "Roads", "Small Road", new ScreenPoint(812.4, 530.1), true, BoxState.Closed, 2, 3));

			Assert.Equal("place", line.GetProperty("event").GetString());
			Assert.Equal(812.4, line.GetProperty("x").GetDouble());
			Assert.Equal(530.1, line.GetProperty("y").GetDouble());
			Assert.True(line.GetProperty("cameraMoved").GetBoolean());
			Assert.Equal("closed", line.GetProperty("box").GetString());
			Assert.Equal(2, line.GetProperty("tabSwitches").GetInt32());
			Assert.Equal(3, line.GetProperty("sinceArm").GetInt32());
		}

		[Fact]
		public void ANameWithQuotesAndANewlineStaysOneLineOfJson()
		{
			var line = Parsed(new PickArm(1, "Parks & Recreation", "The \"Big\"\nPark", PickSource.Bbm));

			Assert.Equal("Parks & Recreation", line.GetProperty("menu").GetString());
			Assert.Equal("The \"Big\"\nPark", line.GetProperty("prefab").GetString());
		}

		[Fact]
		public void BackslashesControlCharactersNonAsciiAndALoneSurrogateRoundTrip()
		{
			var menu = "Back\\slash \u0001 caf\u00e9";
			var prefab = "Pair \ud83c\udfd7 \u2603";
			var line = Parsed(new PickArm(1, menu, prefab, PickSource.Bbm));

			Assert.Equal(menu, line.GetProperty("menu").GetString());
			Assert.Equal(prefab, line.GetProperty("prefab").GetString());
		}

		[Fact]
		public void ALoneSurrogateBecomesTheReplacementCharacterSoTheLineParses()
		{
			var line = Parsed(new PickArm(1, "Roads", "Lone \ud800 high, \udc00 low", PickSource.Bbm));

			Assert.Equal("Lone \ufffd high, \ufffd low", line.GetProperty("prefab").GetString());
		}

		[Fact]
		public void ACommaDecimalCultureStillWritesDotDecimals()
		{
			var before = CultureInfo.CurrentCulture;

			try
			{
				CultureInfo.CurrentCulture = new CultureInfo("de-DE");
				var pick = new PickPlace(1.256, "Roads", "Small Road", new ScreenPoint(812.4, 530.1), false, BoxState.Open, 0, 1);
				var text = PickLogJson.Line(pick);
				var line = Parsed(pick);

				Assert.Contains("812.4", text);
				Assert.Equal(812.4, line.GetProperty("x").GetDouble());
				Assert.Equal(1.26, line.GetProperty("t").GetDouble());
			}
			finally
			{
				CultureInfo.CurrentCulture = before;
			}
		}

		[Fact]
		public void ANonFiniteCoordinateLeavesTheFieldOutAndTheLineValid()
		{
			var at = ScreenPoint.FromPixels(float.NaN, float.PositiveInfinity, 1080);
			var line = Parsed(new PickPlace(double.NaN, "Roads", "Small Road", at, false, BoxState.Open, 0, 1));

			Assert.False(line.TryGetProperty("x", out _));
			Assert.False(line.TryGetProperty("y", out _));
			Assert.False(line.TryGetProperty("t", out _));
			Assert.Equal("place", line.GetProperty("event").GetString());
		}
	}
}
