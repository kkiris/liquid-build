const { Liquid } = require('liquidjs');
const fs = require('fs-extra');
const path = require('path');

const engine = new Liquid();

const globalConfigPath = path.join(__dirname, '../config/global.json');
const sharedConfigPath = path.join(__dirname, '../config/shared.json');
const buildsConfigPath = path.join(__dirname, '../config/builds.json');

const sharedDir = path.join(__dirname, '../shared');
const buildDir = path.join(__dirname, '../build');
const renderedDir = path.join(__dirname, '../rendered');

function findLiquids(dir, root = dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	let files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files = files.concat(findLiquids(fullPath, root));
		} else if (entry.isFile() && entry.name.endsWith('.liquid')) {
			const relativePath = path.relative(root, fullPath);
			files.push(relativePath);
		}
	}

	return files;
}

function renderConfigValues(obj, context) {
	if (Array.isArray(obj)) {
		return obj.map(item => renderConfigValues(item, context));
	} else if (typeof obj === 'object' && obj !== null) {
		const result = {};
		for (const [key, value] of Object.entries(obj)) {
			result[key] = renderConfigValues(value, context);
		}
		return result;
	} else if (typeof obj === 'string') {
		return engine.parseAndRenderSync(obj, context);
	}
	return obj;
}

async function renderTemplates() {
	const globalConfig = await fs.readJson(globalConfigPath);
	const sharedConfig = await fs.readJson(sharedConfigPath);
	const buildsConfig = await fs.readJson(buildsConfigPath);

	await fs.ensureDir(renderedDir);

	for (const [build, buildConfig] of Object.entries(buildsConfig)) {
		const buildGroups = ['_global', ...(buildConfig.groups || [])];

		const groupConfig = buildGroups.reduce((acc, group) => {
			const groupData = sharedConfig[group];
			if (groupData && typeof groupData === 'object') {
				return { ...acc, ...groupData };
			}
			return acc;
		}, {});

		const context = {
			build,			// the build key in builds.json
			...globalConfig,
			...groupConfig,
			...buildConfig
		};

		const renderedContext = renderConfigValues(context, context);

		for (const group of [...new Set(buildGroups)]) {
			const groupTemplateDir = path.join(sharedDir, group);
			const groupOutputDir = path.join(renderedDir, 'shared', group);

			if (!(await fs.pathExists(groupTemplateDir))) continue;

			const templates = findLiquids(groupTemplateDir);
			for (const relativePath of templates) {
				const inputPath = path.join(groupTemplateDir, relativePath);
				const rawTemplate = await fs.readFile(inputPath, 'utf8');
				const rendered = await engine.parseAndRender(rawTemplate, renderedContext);

				const outputPath = path.join(groupOutputDir, relativePath.replace(/\.liquid$/, ''));
				await fs.ensureDir(path.dirname(outputPath));

				let output = rendered;
				try {
					const parsed = JSON.parse(rendered);
					output = JSON.stringify(parsed, (key, value) => {
						if (
							Array.isArray(value) &&
							value.length <= 3 &&
							value.every(item => typeof item === 'number')
						) {
							return `__INLINE__${JSON.stringify(value)}__INLINE__`;
						}
						return value;
					}, '\t');

					output = output.replace(
						/"__INLINE__(\[[\d,\s]+\])__INLINE__"/g,
						(_, content) => content.replace(/\s+/g, '')
					);
					console.log(`🧾 Formatted JSON: shared/${group}/${relativePath}`);
				} catch {
					// not JSON, skip formatting
				}

				await fs.writeFile(outputPath, output);
				console.log(`✅ Rendered: shared/${group}/${relativePath}`);
			}
		}

		const buildTemplateDir = path.join(buildDir, build);
		if (await fs.pathExists(buildTemplateDir)) {
			const templates = findLiquids(buildTemplateDir);
			const buildOutputDir = path.join(renderedDir, 'build', build);

			for (const relativePath of templates) {
				const inputPath = path.join(buildTemplateDir, relativePath);
				const rawTemplate = await fs.readFile(inputPath, 'utf8');
				const rendered = await engine.parseAndRender(rawTemplate, renderedContext);

				const outputPath = path.join(buildOutputDir, relativePath.replace(/\.liquid$/, ''));
				await fs.ensureDir(path.dirname(outputPath));

				let output = rendered;
				try {
					const parsed = JSON.parse(rendered);
					output = JSON.stringify(parsed, (key, value) => {
						if (
							Array.isArray(value) &&
							value.length <= 3 &&
							value.every(item => typeof item === 'number')
						) {
							return `__INLINE__${JSON.stringify(value)}__INLINE__`;
						}
						return value;
					}, '\t');

					output = output.replace(
						/"__INLINE__(\[[\d,\s]+\])__INLINE__"/g,
						(_, content) => content.replace(/\s+/g, '')
					);
					console.log(`🧾 Formatted JSON: build/${buildTag}/${relativePath}`);
				} catch {
					// not JSON, skip formatting
				}

				await fs.writeFile(outputPath, output);
				console.log(`✅ Rendered: build/${build}/${relativePath}`);
			}
		}
	}
}

renderTemplates().catch(err => {
	console.error('❌ Render failed:', err);
	process.exit(1);
});