# Continuous integration

Two workflows, kept in `tools/ci/` because a workflow file has to be added by someone with
permission to change workflows. Copy both to `.github/workflows/` to turn them on.

- **`ui.yml`** runs for every pull request and push, forks included: `npm test` (typecheck, lint,
  unit and render suites), the webpack build, and a parse of `build.sh`. The UI needs nothing
  from the game; the test harness stubs its `cs2/*` modules.
- **`csharp.yml`** builds the mod and runs the xUnit tests (`./build.sh backend`,
  `./build.sh test`) against **mock game assemblies** checked out from a private repository.
  A pull request from a fork gets no secrets, so it skips this job rather than failing it.

## The mock assemblies

The mod compiles against 18 of the game's assemblies from `Cities2_Data/Managed`. This
repository is public and those assemblies are the game's code, so CI never sees them. It uses
copies with every method body replaced by `throw new NotImplementedException()`, made with
JetBrains Refasmer (`--all --mock`):

- Every type, member and signature is kept, private struct fields included, so the mod
  compiles exactly as against the real thing. The compiler reads those fields for the
  `unmanaged` constraint ECS code relies on.
- Unlike a reference assembly, a mock loads at run time, so a test can use the game's types.
  A test that calls into the game gets `NotImplementedException: … not implemented in mock
  library`.
- None of the game's code is in them, but they still carry its API, names included. Keep the
  repository that holds them private.

Tests that need the game's behaviour carry `[Trait("Requires", "Game")]`. CI runs with
`CS2_TEST_FILTER=Requires!=Game`, which `build.sh test` passes to `dotnet test --filter`. Run
without the filter locally, against the real install, they all run.

Two ways a test breaks against the mocks without calling a game method:

- **Reading a static field of a game type** runs its type initializer, which the mocks replace
  with a throw. `DlcId.Invalid` and `DlcId.BaseGame` are the ones the catalog needs; it compares
  against `Domain/GameDlcIds` instead, and `GameDlcIdsTests` (tagged `Requires=Game`) pins
  those constants to the game's values.
- **A game enum inside `[InlineData]`** cannot be decoded against the mocks, and xUnit drops the
  cases without reporting anything: the run passes with fewer tests. Pass the member's name
  (`nameof(AreaType.Residential)`) and parse it in the test. After a refresh, check that the
  mock run's total is the full run's total less the tagged tests.

## One-time setup

1. Create an empty **private** repository, `gerbal/cs2-game-refs`. If it is named otherwise,
   change `repository:` in `csharp.yml` to match.
2. Clone it somewhere outside this repository (the script refuses a path inside it), and
   generate the mocks from your install:

   ```sh
   tools/game-refs/refresh.sh --refs ../cs2-game-refs --label <game version> --verify
   ```

   It reads the game from `$CS2_GAME_PATH`, or the Steam path `Directory.Build.props` defaults
   to. It takes the list of assemblies from the two `.csproj` files, writes the mocks to
   `Cities2_Data/Managed` in the clone with a `MANIFEST.md` of what they were made from, and
   `--verify` then builds and tests this repository against them, as CI will.
3. A test that fails under `--verify` but passes with a plain `./build.sh test` calls into the
   game: tag it `[Trait("Requires", "Game")]`. A test that fails both ways is a real failure.
4. Commit and push the clone; the script prints the command.
5. Give CI read access with a deploy key, which reaches that one repository and nothing else:

   ```sh
   ssh-keygen -t ed25519 -N "" -C cs2-game-refs-ci -f cs2-game-refs-ci
   ```

   - `cs2-game-refs-ci.pub` goes in **cs2-game-refs → Settings → Deploy keys**, with *Allow
     write access* left off.
   - `cs2-game-refs-ci` (the private half) goes in **this repository → Settings → Secrets and
     variables → Actions** as `CS2_REFS_DEPLOY_KEY`.
   - Then delete both files.
6. Copy `tools/ci/csharp.yml` and `tools/ci/ui.yml` to `.github/workflows/`.

## After a game update

A game update can add, remove or change what the mod compiles against. Rerun step 2 with the
new version as the label, then push:

```sh
tools/game-refs/refresh.sh --refs ../cs2-game-refs --label <new version> --verify
```

Until then, CI builds against the previous version's assemblies and cannot see what changed.

## Keeping them private

- **Never upload `cs2-refs` as a workflow artifact.** On a public repository anyone who can see
  the repository can download artifacts.
- **Never put it in the Actions cache.** A pull request, a fork's included, can restore caches
  made on the default branch.
- **Never run `csharp.yml` on `pull_request_target`.** That event gives a fork's code the
  repository's secrets.
- **The checkout does not keep the key** (`persist-credentials: false`), so later steps cannot
  reuse it.

## What CI does not cover

- The tests tagged `Requires=Game`. Run `./build.sh test` locally before a release.
- The game itself: a mock compiles and loads, and does nothing more. The in-game checks in
  [release-checklist.md](release-checklist.md) still apply.
