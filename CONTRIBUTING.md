# Contributing to Kovi

Thank you for your interest in contributing to Kovi! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 9.12.0+ (recommended: `corepack use pnpm@9.12.0` to match CI)
- Docker (for local infrastructure)

### Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd kovi-engine

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Start local infrastructure
docker compose -f infra/docker-compose/docker-compose.yml up -d

# Run all services (in separate terminals)
pnpm --filter @kovi/api dev
pnpm --filter @kovi/orchestrator dev
pnpm --filter @kovi/extractor-worker dev
pnpm --filter @kovi/browser-worker dev
pnpm --filter @kovi/admin dev
```

### Running Checks

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Run all tests
pnpm test

# Build
pnpm build

# Verify environment
pnpm verify:env

# Verify migrations
pnpm verify:migrations
```

## Project Structure

```
kovi-engine/
├── apps/               # Application services
│   ├── api/           # Main API server
│   ├── admin/         # Admin control plane
│   ├── browser-worker/# Browser-based extraction worker
│   ├── extractor-worker/ # Static extraction worker
│   └── orchestrator/  # Temporal workflow orchestrator
├── packages/          # Shared packages
│   ├── config/       # Configuration management
│   ├── contracts/    # Event contract definitions
│   ├── db/           # Database access layer
│   ├── events/       # Event bus and destination plugins
│   ├── observability/# OpenTelemetry setup
│   ├── shared/       # Shared utilities
│   └── source-sdk/   # Source adapter SDK
├── adapters/         # Packaged source adapters
├── infra/            # Infrastructure configuration
├── docs/             # Documentation
└── scripts/          # Development and scaffolding scripts
```

## How to Contribute

### Reporting Issues

1. Check existing issues to avoid duplicates
2. Provide clear reproduction steps
3. Include environment details (OS, Node version, etc.)
4. For security issues, see [SECURITY.md](./SECURITY.md)

### Submitting Changes

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Add or update tests as needed
5. Ensure all checks pass (`pnpm lint && pnpm typecheck && pnpm test`)
6. Submit a pull request

### Code Style

- Follow existing code conventions
- Use TypeScript strict mode
- Write meaningful commit messages
- Add comments for complex logic

### Creating Source Adapters

Use the scaffold command:

```bash
node scripts/scaffold-adapter.mjs static-html my-adapter
```

See [docs/Contributor-Guide.md](./docs/Contributor-Guide.md) for adapter development details.

### Creating Destination Plugins

Use the scaffold command:

```bash
node scripts/scaffold-destination-plugin.mjs my-destination
```

See [packages/events/src/destinations/types.ts](./packages/events/src/destinations/types.ts) for the plugin interface.

## Architecture Decisions

Architecture decisions are documented in [docs/adr/](./docs/adr/). Review existing ADRs before proposing significant changes.

## Testing

### Test Structure

- Unit tests: `packages/*/tests/unit/`
- Integration tests: `packages/*/tests/integration/`
- E2E tests: `packages/*/tests/e2e/`

### Running Specific Tests

```bash
# Test a specific package
pnpm --filter @kovi/source-sdk test

# Run unit tests only
pnpm --filter @kovi/source-sdk test:unit

# Run with coverage
pnpm --filter @kovi/source-sdk test --coverage
```

## Documentation

- Update documentation when changing behavior
- Add ADRs for architectural decisions
- Update API documentation for route changes

## License

See [LICENSE](./LICENSE) for licensing information.

## Questions?

Open an issue for questions about contributing.
