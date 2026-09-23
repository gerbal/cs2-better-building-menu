namespace System.Diagnostics.CodeAnalysis
{
	/// <summary>
	/// The compiler's "not null when this returns <paramref name="returnValue"/>" for a
	/// Try method's out parameter.
	/// </summary>
	/// <remarks>
	/// net48 does not ship these, and the compiler matches them by name, so internal copies
	/// are enough for the nullable analysis to read them. Embedded, so an assembly that sees
	/// this one's internals and has the real ones (the net10 tests) does not see two.
	/// </remarks>
	[AttributeUsage(AttributeTargets.Parameter)]
	[Microsoft.CodeAnalysis.Embedded]
	internal sealed class NotNullWhenAttribute : Attribute
	{
		public NotNullWhenAttribute(bool returnValue) => ReturnValue = returnValue;

		public bool ReturnValue { get; }
	}

	/// <summary>The compiler's "not null when that parameter is not null", for a return value.</summary>
	[AttributeUsage(AttributeTargets.Parameter | AttributeTargets.Property | AttributeTargets.ReturnValue, AllowMultiple = true)]
	[Microsoft.CodeAnalysis.Embedded]
	internal sealed class NotNullIfNotNullAttribute : Attribute
	{
		public NotNullIfNotNullAttribute(string parameterName) => ParameterName = parameterName;

		public string ParameterName { get; }
	}
}

namespace Microsoft.CodeAnalysis
{
	/// <summary>The compiler's mark for a type no other assembly should see, internals included.</summary>
	[Embedded]
	internal sealed class EmbeddedAttribute : System.Attribute
	{
	}
}
