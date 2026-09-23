const { ReplaceSource } = require("webpack").sources;

exports.CSSPresencePlugin = class CSSPresencePlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap("CSSPresencePlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "CSSPresencePlugin",
          stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          const cssFiles = Object.keys(compilation.assets).filter((asset) =>
            asset.endsWith(".css")
          );
          const hasCSS = cssFiles.length > 0;

          // Inject the `hasCSS` export into the main module source
          for (const chunk of compilation.chunks) {
            for (const file of chunk.files) {
              if (file.endsWith(".mjs")) {
                const asset = compilation.getAsset(file);
                const at = asset.source.source().indexOf("export {");
                if (at < 0) continue;

                // An edit of the original source rather than a new one, so a
                // development build keeps its source map.
                const updated = new ReplaceSource(asset.source);
                updated.replace(at, at + "export {".length - 1, `const hasCSS = ${hasCSS}; export { hasCSS, `);
                compilation.updateAsset(file, updated);
              }
            }
          }
        }
      );
    });
  }
};
