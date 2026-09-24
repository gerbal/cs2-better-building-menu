#:property TargetFramework=net10.0
#:property LangVersion=latest

// Makes Refasmer's mock assemblies loadable, in place: --mock gives the runtime's own
// methods a body, and the runtime refuses to load a type holding one. Run by
// refresh.sh; see docs/ci.md, "The mock assemblies".

using System.Buffers.Binary;
using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;

if (args.Length != 1 || !Directory.Exists(args[0]))
{
    Console.Error.WriteLine("Usage: dotnet run FixNativeMethods.cs -- <directory of mock assemblies>");
    return 1;
}

foreach (var path in Directory.GetFiles(args[0], "*.dll").OrderBy(p => p, StringComparer.Ordinal))
{
    var bytes = File.ReadAllBytes(path);
    int internalCalls = 0, runtimeBodies = 0;

    using (var pe = new PEReader(new MemoryStream(bytes, writable: false)))
    {
        if (!pe.HasMetadata)
        {
            continue;
        }

        var metadata = pe.GetMetadataReader();
        int table = pe.PEHeaders.MetadataStartOffset + metadata.GetTableMetadataOffset(TableIndex.MethodDef);
        int rowSize = metadata.GetTableRowSize(TableIndex.MethodDef);

        foreach (var handle in metadata.MethodDefinitions)
        {
            var method = metadata.GetMethodDefinition(handle);

            if (method.RelativeVirtualAddress == 0)
            {
                continue;
            }

            // A MethodDef row starts with RVA (4 bytes), then ImplFlags (2 bytes);
            // ECMA-335 II.22.26. Both are fixed-width, so the edit changes no size.
            var row = bytes.AsSpan(table + (MetadataTokens.GetRowNumber(handle) - 1) * rowSize, rowSize);
            var impl = method.ImplAttributes;

            // An internal call keeps the throwing body and stops claiming to be native.
            if ((impl & MethodImplAttributes.InternalCall) != 0)
            {
                BinaryPrimitives.WriteUInt16LittleEndian(row.Slice(4), (ushort)(impl & ~MethodImplAttributes.InternalCall));
                internalCalls++;
            }

            // A delegate's Invoke and the like lose the body, as the real assemblies have them.
            if ((impl & MethodImplAttributes.CodeTypeMask) == MethodImplAttributes.Runtime)
            {
                BinaryPrimitives.WriteUInt32LittleEndian(row, 0);
                runtimeBodies++;
            }
        }
    }

    if (internalCalls + runtimeBodies > 0)
    {
        File.WriteAllBytes(path, bytes);
        Console.WriteLine($"{Path.GetFileName(path)}: {internalCalls} internal call(s), {runtimeBodies} runtime-implemented method(s)");
    }
}

return 0;
