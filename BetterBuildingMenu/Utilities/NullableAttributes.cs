namespace System.Diagnostics.CodeAnalysis
{
	/// <summary>
	/// The compiler's "not null when this returns <paramref name="returnValue"/>" for a
	/// Try method's out parameter.
	/// </summary>
	/// <remarks>
	/// net48 does not ship these, and the compiler matches them by name, so internal copies
	/// are enough for the nullable analysis to read them.
	/// </remarks>
	[AttributeUsage(AttributeTargets.Parameter)]
	internal sealed class NotNullWhenAttribute : Attribute
	{
		public NotNullWhenAttribute(bool returnValue) => ReturnValue = returnValue;

		public bool ReturnValue { get; }
	}

	/// <summary>The compiler's "not null when that parameter is not null", for a return value.</summary>
	[AttributeUsage(AttributeTargets.Parameter | AttributeTargets.Property | AttributeTargets.ReturnValue, AllowMultiple = true)]
	internal sealed class NotNullIfNotNullAttribute : Attribute
	{
		public NotNullIfNotNullAttribute(string parameterName) => ParameterName = parameterName;

		public string ParameterName { get; }
	}
}
