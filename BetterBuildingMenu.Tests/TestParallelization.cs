using Xunit;

// A precaution. The mod keeps the prefab index, the placed uniques and the toolbar selection in
// process-wide statics, and three test classes set them. No class reads what another sets
// today; this stops one that does from racing it. Serial until those statics become the
// per-load catalog index; see CONTRIBUTING.md, "Build and test". A runner setting
// (xUnit.ParallelizeTestCollections, or an xunit.runner.json) overrides this.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
