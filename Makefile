install-local:
	pnpm install
	pnpm build
	pnpm link --global
