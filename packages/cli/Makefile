build-web:
	deno bundle web/index.ts | \
		esbuild --bundle --minify \
		--outfile=public/index.min.js
