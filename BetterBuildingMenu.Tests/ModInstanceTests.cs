using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class ModInstanceTests
	{
		private const byte Nop = 0x00;
		private const byte LdArg0 = 0x02;
		private const byte Call = 0x28;
		private const byte Ret = 0x2A;

		/// <summary>
		/// The game builds Mod with FormatterServices.GetUninitializedObject
		/// (ModManager), so no constructor runs and a field initializer never
		/// happens: the field is null in game. #18's _localeSources was, and
		/// OnLoad threw on it.
		/// </summary>
		/// <remarks>
		/// Read from the constructor's IL rather than by building a Mod, whose
		/// static logger needs the running game. C# emits a field initializer
		/// ahead of the base constructor call, so a constructor with none is
		/// `ldarg.0; call object::.ctor`, then nothing but nop and ret.
		/// </remarks>
		[Fact]
		public void Mod_DeclaresNoInstanceFieldInitializers()
		{
			var il = typeof(Mod).GetConstructor(Type.EmptyTypes)!.GetMethodBody()!.GetILAsByteArray()!;

			Assert.True(il.Length >= 6 && il[0] == LdArg0 && il[1] == Call,
				"Mod's constructor does work before calling object(): a field initializer, which the game never runs. Assign it in OnLoad.");
			Assert.All(il.Skip(6), op => Assert.Contains(op, new[] { Nop, Ret }));
		}
	}
}
