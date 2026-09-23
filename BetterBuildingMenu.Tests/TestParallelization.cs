using Xunit;

// The mod keeps the prefab index, the placed uniques and the toolbar selection in process-wide
// statics, which several test classes set and many more read through the adapter. xUnit runs
// test classes in parallel, so one could read another's values mid-test. Serial until those
// statics become the per-load catalog index; see CONTRIBUTING.md, "Build and test".
[assembly: CollectionBehavior(DisableTestParallelization = true)]
