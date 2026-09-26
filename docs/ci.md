# Continuous integration

Two workflows, in `.github/workflows/`. Changing either needs a token with the `workflow`
scope (`gh auth refresh -s workflow`); GitHub refuses a push that touches them otherwise.

- **`ui.yml`** runs for every pull request and push, forks included: `npm test` (typecheck, lint,
  unit and render suites), the webpack build, and a parse of `build.sh`. The UI needs nothing
  from the game; the test harness stubs its `cs2/*` modules.
- **`csharp.yml`** builds the mod and runs every xUnit test (`./build.sh backend`,
  `./build.sh test`) against **the game's own assemblies**, checked out from a private
  repository. A pull request from a fork gets no secrets, so it skips this job rather than
  failing it: run the same two commands against your own install before opening one.

## The game assemblies

The mod compiles against 18 of the game's assemblies from `Cities2_Data/Managed`. CI checks out
unmodified copies of them, kept in a private repository with a read-only deploy key
(`CS2_REFS_DEPLOY_KEY`), so it builds exactly as a local build does and runs the whole suite,
`Requires=Game` tests included. The maintainer refreshes those copies after each game update;
until then, CI builds against the previous version's.

**What cannot run anywhere outside the game:** Unity's native side. A test that reaches an
internal call (a `LogManager` logger, `Application.persistentDataPath`, the static initializer
of `Mod`) fails with a `SecurityException` (`ECall methods must be packaged into a system
module`) locally and in CI alike. Such a test doesn't belong in the suite; the in-game checks
cover that code.

## The mock assemblies

The suite is kept runnable against mock copies of those assemblies too, for a setup that must
not hold the game's code. A mock keeps every type, member and signature, private struct fields
included, and replaces every method body with `throw new NotImplementedException()` (JetBrains
Refasmer's `--all --mock`, with Unity's internal calls and delegates' `Invoke` left bodiless so
the runtime loads them).

A test that calls into the game fails against mocks, so it carries
`[Trait("Requires", "Game")]`, and a mock run filters it out with
`CS2_TEST_FILTER=Requires!=Game`, which `build.sh test` passes to `dotnet test --filter`.

Two ways a test breaks against mocks without calling a game method:

- **Reading a static field of a game type** runs its type initializer, which the mocks replace
  with a throw. `DlcId.Invalid` and `DlcId.BaseGame` are the ones the catalog needs; it compares
  against `Domain/GameDlcIds` instead, and `GameDlcIdsTests` (tagged `Requires=Game`) pins
  those constants to the game's values.
- **A game enum inside `[InlineData]`** cannot be decoded against the mocks, and xUnit drops the
  cases without reporting anything: the run passes with fewer tests. Pass the member's name
  (`nameof(AreaType.Residential)`) and parse it in the test.

## Keeping them private

The copies are the game's code, and this repository may be public. They may exist only in the
private repository and inside a runner:

- **Never upload `cs2-refs` as a workflow artifact.** Anyone who can see the repository can
  download its artifacts.
- **Never put it in the Actions cache.** A pull request, a fork's included, can restore caches
  made on the default branch.
- **Never run `csharp.yml` on `pull_request_target`.** That event gives a fork's code the
  repository's secrets.
- **The checkout does not keep the key** (`persist-credentials: false`), so later steps cannot
  reuse it.
- **Nothing in the job may print the assemblies' contents**, such as a step that decompiles or
  dumps them. Anyone who can see the repository can read the job's log.

## The .NET SDK

`csharp.yml` installs one exact SDK, the `dotnet-version` its `setup-dotnet` step names, rather
than the newest `10.0.x`. CI fails on any warning, and a newer SDK can bring new ones, so it
arrives as a change of its own instead of overnight in someone else's pull request. To move to a
newer SDK, change that version in a pull request of its own and fix whatever its warnings show
there.

Local builds are not pinned. There is no `global.json`, so the build you play with uses whatever
.NET 10 SDK is installed. A local build that shows a warning CI does not may just be a newer SDK.

## What CI does not cover

- The game itself: the assemblies load, but Unity's native side and the game's ECS world do not
  run outside it. The in-game checks in [release-checklist.md](release-checklist.md) still
  apply.
