# Black Swamp n8n community-node template

A fail-closed TypeScript starter for production-quality n8n community integrations. It retains n8n's useful Example and GitHub Issues implementations for study, adds strict Vitest tests, release audits, and provenance-ready GitHub Actions.

> [!WARNING]
> This repository is a template, not a publishable integration. `private: true` intentionally blocks publication. The examples, identity, and this README must be removed or adapted after generating a project.

## Start from the template

1. Select **Use this template → Create a new repository** on GitHub.
2. Create the final public repository, then clone it.
3. Work in bounded, reviewed batches; do not create a version tag during initialization.

```sh
git clone https://github.com/YOUR-OWNER/YOUR-REPOSITORY.git
cd YOUR-REPOSITORY
npm ci
```

## Deterministic initialization checklist

- Choose the final GitHub repository and scoped or unscoped `n8n-nodes-*` npm name.
- Replace package name, description, author, homepage, repository, keywords, and node metadata URLs/categories.
- Replace this file with `README_TEMPLATE.md`, rename it to `README.md`, and resolve every placeholder.
- Remove or adapt the Example and GitHub Issues nodes, credentials, icons, and registrations.
- Replace or remove raw-template invariant tests, especially `tests/template.test.ts`, when removing `private: true` and the example registrations; add product-specific invariants in their place.
- Register every intended compiled node and credential using stable `dist/` paths.
- Keep `private: true` until identity, documentation, tests, and registration are final; then remove it.
- Run `npm install` once after identity/tooling changes and commit the regenerated lockfile.
- Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run package:check`.
- Install or load the dry-run package in a disposable n8n instance before release.
- Never tag early. Only an explicitly authorized, reviewed release commit receives an immutable version tag.

## Examples included

- `nodes/Example/`: minimal programmatic node.
- `nodes/GithubIssues/` and `credentials/`: declarative API node, list search, pagination helper, PAT, and OAuth examples.

These are learning fixtures. Shipping their names, registrations, or credentials in an unrelated integration is a release-audit failure.

## Development commands

| Command                 | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Run the local n8n node development environment     |
| `npm run format:check`  | Check formatting                                   |
| `npm run lint`          | Run n8n community-node lint rules                  |
| `npm run typecheck`     | Strictly check production and test TypeScript      |
| `npm test`              | Run all `*.test.ts` files with Vitest              |
| `npm run build`         | Compile nodes and copy static assets               |
| `npm run release:check` | Validate template mode or final release identity   |
| `npm run package:check` | Audit and inspect the dry-run npm tarball boundary |

Read `RELEASING.md` before changing `private`, creating a tag, or configuring npm publishing.

## Upstream resources

- [n8n node development](https://docs.n8n.io/integrations/creating-nodes/)
- [Community-node verification](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/)
- [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)

## License

[MIT](LICENSE.md)
