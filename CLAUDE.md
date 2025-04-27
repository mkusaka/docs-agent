# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands

- Build/Deploy: `pnpm run deploy` (builds with Vite and deploys with Wrangler)
- Development: `pnpm start` (starts Vite dev server)
- Lint: `pnpm run check` (runs Prettier check, Biome lint, and TypeScript)
- Format: `pnpm run format` (formats code with Prettier)
- Test: `pnpm test` (runs tests with Vitest)
- Single test: `pnpm test <test-name>` (runs specific test with Vitest)

## Code Style Guidelines

- Use TypeScript with strict type checking
- Use ES modules for imports/exports
- Organize imports (enabled in Biome)
- Use double quotes for JavaScript/TypeScript (per Biome config)
- Follow absolute imports using "@/\*" path alias for src directory
- Follow Cloudflare Workers best practices (from .cursor/rules/cloudflare.mdc)
- Implement proper error boundaries and meaningful error messages
- Use pnpm as package manager (not npm)
- Format code with Prettier before committing
- Always run checks before deploying: `pnpm run check`
