const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

const globalConfigPath = path.join(__dirname, '../config/global.json');
const sharedConfigPath = path.join(__dirname, '../config/shared.json');
const buildsConfigPath = path.join(__dirname, '../config/builds.json');

const staticBuildDir = path.join(__dirname, '../build');
const staticSharedDir = path.join(__dirname, '../shared');
const renderedDir = path.join(__dirname, '../rendered');

const outputDir = path.join(__dirname, '../packaged');

async function packageZips() {
	const globalConfig = await fs.readJson(globalConfigPath);
	const sharedConfig = await fs.readJson(sharedConfigPath);
	const buildsConfig = await fs.readJson(buildsConfigPath);

	await fs.ensureDir(outputDir);

	for (const [build, buildConfig] of Object.entries(buildsConfig)) {
		const groups = ['_global', ...(buildConfig.groups || [])];

		// merge config from groups
		const groupConfig = groups.reduce((acc, group) => {
			const groupData = sharedConfig[group];
			if (groupData && typeof groupData === 'object') {
				return { ...acc, ...groupData };
			}
			return acc;
		}, {});

		const buildName = buildConfig.name || groupConfig.name || globalConfig.name || 'addon';
		const buildVersion = buildConfig.version || groupConfig.version || globalConfig.version || '0.0.0';
		const ext = buildConfig._ext || groupConfig._ext || globalConfig._ext || 'zip';

		const zipName = `${buildName} v${buildVersion}+${build}.${ext}`;
		const zipPath = path.join(outputDir, zipName);

		const archive = archiver('zip', { zlib: { level: 9 } });
		const stream = fs.createWriteStream(zipPath);

		archive.pipe(stream);

		// add static shared files
		for (const group of groups) {
			const groupDir = path.join(staticSharedDir, group);
			if (await fs.pathExists(groupDir)) {
				archive.glob('**/*', {
					cwd: groupDir,
					ignore: ['**/*.liquid'],
				});
				console.log(`📁 Added static shared files from group: '${group}'`);
			} else {
				console.warn(`⚠️ Shared group directory missing: ${groupDir}`);
			}
		}

		// add static build files
		const buildStaticDir = path.join(staticBuildDir, build);
		if (await fs.pathExists(buildStaticDir)) {
			archive.glob('**/*', {
				cwd: buildStaticDir,
				ignore: ['**/*.liquid'],
			});
			console.log(`📁 Added static build files from build: '${build}'`);
		}

		// add rendered templates
		const renderedBuildDir = path.join(renderedDir, build);
		if (await fs.pathExists(renderedBuildDir)) {
			archive.directory(renderedBuildDir, false);
			console.log(`🧾 Added rendered templates from build: '${build}'`);
		}

		await archive.finalize();

		console.log(`📦 Packaged: ${zipName}`);
	}
}

packageZips().catch(err => {
	console.error('❌ Packaging failed:', err);
	process.exit(1);
});
