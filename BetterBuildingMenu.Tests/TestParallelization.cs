using Xunit;

// A precaution. No test class sets a process-wide static of the mod; this keeps one that
// does from racing another. See CONTRIBUTING.md, "Build and test". A runner setting
// (xUnit.ParallelizeTestCollections, or an xunit.runner.json) overrides this.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
