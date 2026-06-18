# liquid-build
The `script/` directory contains the following scripts: 
- `render.js`, which renders `.liquid` template files using LiquidJS
- `packagee.js`, which packages static files and rendered templates into ZIP archives
<br>

The templates to be rendered and any static files to be packaged reside in: 
- `shared/_global/`, for templates/files shared between all builds
- `shared/<group>/`, for templates/files shared by builds in group `<group>`
- `build/<build>/`, for templates/files specific to build `<build>`

Any files ending in `.liquid` will be rendered as templates and any other files will be treated as static. 
When packaging builds, rendered templates overwrite static files. Static files can be renamed with `.liquid` to exempt them from this behavior. 
<br><br>

The scripts are configured using JSON files the `config/` directory:
- `global.json`, which stores shared variables for all builds
- `shared.json`, which stores shared variables for build groups
- `builds.json`, which lists the builds and stores build-specific variables
<br>

Template context is applied from the top-down, so later configurations overwrite variables of earlier configurations as follows: 
1. `global.json` (**LOWEST**)
2. `shared.json` (from left-to-right as set in `builds.json`)
3. `builds.json`(**HIGHEST**)

Additionally, `_build` is a special variable set by the script which contains the build key from `builds.json`. Avoid naming variables `_build` in config files, as the build key will take precedence. 
<br>
