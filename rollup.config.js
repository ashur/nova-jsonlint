const commonjs = require( "@rollup/plugin-commonjs" );
const resolve = require( "@rollup/plugin-node-resolve" );

module.exports =
{
	input: "src/scripts/main.js",
	output: {
		file: "JSONLint.novaextension/scripts/main.dist.js",
		format: "cjs",
		exports: "named",
	},
	plugins: [
		commonjs(),
		resolve(),
	],
};
