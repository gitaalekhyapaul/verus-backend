cd typescript
NODE_OPTIONS='--max-old-space-size=8192' pnpm install
NODE_OPTIONS='--max-old-space-size=8192' pnpm build
cd ../examples/typescript
NODE_OPTIONS='--max-old-space-size=8192' pnpm install
NODE_OPTIONS='--max-old-space-size=8192' pnpm build