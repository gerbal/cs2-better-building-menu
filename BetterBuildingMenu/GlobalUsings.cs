global using System;
global using System.Collections.Generic;
global using System.Linq;

// net48 does not define IsExternalInit, which C# records and init-only
// properties require.
namespace System.Runtime.CompilerServices;

internal static class IsExternalInit
{
}
