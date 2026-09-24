using BetterBuildingMenu.Domain;

using System;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// When a dictionary change earns a full pass: on the next update for a language
	/// the player switched to, once and late for the sources mods add while loading.
	/// </summary>
	/// <remarks>
	/// The game raises onActiveDictionaryChanged for every source added or removed,
	/// not only for a language change, and a full pass costs seconds. Eight of them
	/// in a minute at the main menu was the bug this pins.
	/// </remarks>
	public sealed class LocaleReindexPolicyTests
	{
		private static readonly TimeSpan Quiet = TimeSpan.FromSeconds(1);
		private static readonly TimeSpan T0 = TimeSpan.FromSeconds(100);

		[Fact]
		public void IgnoresEventsBeforeAnythingWasIndexed()
		{
			// Nothing cached, nothing stale: the first full pass reads the
			// dictionary as it stands then.
			var policy = new LocaleReindexPolicy(Quiet);

			Assert.Equal(LocaleReindexDecision.None, policy.Observe("en-US", T0));
			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(T0 + Quiet + Quiet));
		}

		[Fact]
		public void DefersASourceAddedInTheIndexedLocale()
		{
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");

			Assert.Equal(LocaleReindexDecision.Deferred, policy.Observe("en-US", T0));
			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(T0));
			Assert.Equal(LocaleReindexDecision.Deferred, policy.TakeDue(T0 + Quiet));
			// Consumed: the next frame must not run a second pass.
			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(T0 + Quiet + Quiet));
		}

		[Fact]
		public void ABurstOfSourcesIsOnePassAfterTheLast()
		{
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");

			for (var i = 0; i < 8; i++)
			{
				Assert.Equal(LocaleReindexDecision.Deferred, policy.Observe("en-US", T0 + TimeSpan.FromMilliseconds(200 * i)));
			}

			var last = T0 + TimeSpan.FromMilliseconds(1400);
			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(last + TimeSpan.FromMilliseconds(999)));
			Assert.Equal(LocaleReindexDecision.Deferred, policy.TakeDue(last + Quiet));
			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(last + Quiet + Quiet));
		}

		[Fact]
		public void ALanguageThePlayerSwitchedToIsDueOnTheNextUpdateOnce()
		{
			// Every cached name is in the wrong language: no quiet interval to wait
			// out. Due rather than run, so the pass comes from OnUpdate, which runs
			// only while a city is loaded.
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");

			Assert.Equal(LocaleReindexDecision.Immediate, policy.Observe("de-DE", T0));
			Assert.Equal(LocaleReindexDecision.Immediate, policy.TakeDue(T0));
			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(T0 + Quiet + Quiet));
		}

		[Fact]
		public void ALanguageSwitchSupersedesAPendingDeferral()
		{
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			policy.Observe("en-US", T0);

			Assert.Equal(LocaleReindexDecision.Immediate, policy.Observe("de-DE", T0 + TimeSpan.FromMilliseconds(100)));
			Assert.Equal(LocaleReindexDecision.Immediate, policy.TakeDue(T0 + Quiet + Quiet));
			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(T0 + Quiet + Quiet + Quiet));
		}

		[Fact]
		public void SwitchingAwayAndBackBeforeTheUpdateIsOnePass()
		{
			// The language change is answered first and marks the locale indexed, which
			// covers the deferral the switch back scheduled: one pass, not two.
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			policy.Observe("de-DE", T0);
			Assert.Equal(LocaleReindexDecision.Deferred, policy.Observe("en-US", T0 + TimeSpan.FromMilliseconds(100)));

			Assert.Equal(LocaleReindexDecision.Immediate, policy.TakeDue(T0 + Quiet + Quiet));
			policy.MarkIndexed("en-US");

			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(T0 + Quiet + Quiet + Quiet));
		}

		[Fact]
		public void AFailedLanguagePassLeavesALaterDeferralToRetry()
		{
			// A pass that throws marks nothing, so the burst scheduled after the switch
			// still fires: the one retry a failed language pass gets.
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			policy.Observe("de-DE", T0);
			policy.Observe("en-US", T0 + TimeSpan.FromMilliseconds(100));

			Assert.Equal(LocaleReindexDecision.Immediate, policy.TakeDue(T0 + Quiet + Quiet));
			Assert.Equal(LocaleReindexDecision.Deferred, policy.TakeDue(T0 + Quiet + Quiet));
		}

		[Fact]
		public void TheNextCitysPassAbsorbsASwitchMadeWithNoCityLoaded()
		{
			// At the main menu, or during a load, OnUpdate is off and nothing takes
			// the due pass. The next city's own pass reads the new language and
			// marks it, so no second pass follows it once the city is up.
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			policy.Observe("de-DE", T0);

			policy.MarkIndexed("de-DE");

			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(T0 + Quiet + Quiet));
		}

		[Fact]
		public void AFullPassForAnyReasonCoversAPendingDeferral()
		{
			// The save's own pass at OnGameLoaded reads the dictionary as it
			// stands; the deferred one after it would be a repeat.
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			policy.Observe("en-US", T0);

			policy.MarkIndexed("en-US");

			Assert.Equal(LocaleReindexDecision.None, policy.TakeDue(T0 + Quiet + Quiet));
		}

		[Fact]
		public void ASourceAfterTheSwitchIsDeferredAgainstTheNewLocale()
		{
			var policy = new LocaleReindexPolicy(Quiet);
			policy.MarkIndexed("en-US");
			Assert.Equal(LocaleReindexDecision.Immediate, policy.Observe("de-DE", T0));
			policy.MarkIndexed("de-DE");

			Assert.Equal(LocaleReindexDecision.Deferred, policy.Observe("de-DE", T0 + Quiet));
		}
	}
}
