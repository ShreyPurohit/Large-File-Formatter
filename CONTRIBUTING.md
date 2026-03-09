# Contributing

Thanks for your interest in improving Large File Formatter.

## Development setup

1. Install [Node.js](https://nodejs.org/) 22+.
2. Install [pnpm](https://pnpm.io/installation).
3. Install dependencies:
    - `pnpm install`
4. Build once:
    - `pnpm run compile`

## Run locally in VS Code

1. Open this repository in VS Code.
2. Run the `Run Extension` launch configuration (or press `F5`).
3. In the Extension Development Host window, open an XML file.
4. Run `Format Document` or use:
    - `Large File Formatter: Format Current Document`
    - `Large File Formatter: Benchmark Current Document`

## Useful scripts

- `pnpm run compile` - type check, lint, then bundle extension code.
- `pnpm run package` - production bundle used for publishing.
- `pnpm run check-types` - TypeScript type checking only.
- `pnpm run lint` - ESLint checks.
- `pnpm run test` - run extension tests.
- `pnpm run format` - format project files with Prettier.

## Code guidelines

- Keep changes focused and small.
- Preserve formatter safety guarantees:
    - Structural validation must remain intact.
    - Fallback behavior should prefer original text on unsafe output.
- Prefer explicit, readable TypeScript over clever shortcuts.
- Add or update tests when behavior changes.

## Pull request checklist

Before opening a PR, make sure:

- [ ] Code compiles: `pnpm run compile`
- [ ] Lint passes: `pnpm run lint`
- [ ] Tests pass: `pnpm run test`
- [ ] README/settings/commands are updated if user-facing behavior changed
- [ ] Changelog entry is added when appropriate

## Reporting issues

When filing a bug, include:

- Extension version
- VS Code version
- Repro steps
- Expected result vs actual result
- Sample XML (minimal repro) when possible

Large files can be sanitized or reduced, but keep the structure needed to reproduce the issue.
