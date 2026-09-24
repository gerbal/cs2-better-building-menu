using Xunit;

// A precaution. The mod keeps the prefab index and the placed uniques in process-wide
// statics, and two test classes set them. No class reads what another sets today; this
// stops one that does from racing it. Serial until those statics become the per-load
// catalog index; see CONTRIBUTING.md, "Build and test". A runner setting
// (xUnit.ParallelizeTestCollections, or an xunit.runner.json) overrides this.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
