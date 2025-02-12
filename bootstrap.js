const [major] = process.versions.node.split('.').map(Number);

if (major < 20) {
  throw new Error(
    `Unsupported Node.js version: ${process.version}. Please use Node.js 20 or higher.`
  );
}

const fs = require("node:fs/promises");
const childProcess = require("child_process");
const path = require("path");

const miniEjs = require('./_lib/mini-ejs');

const resolveFromRoot = (...args) => path.resolve(__dirname, ...args);

function exec(command) {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, { cwd: __dirname }, (err, stdout, stderr) =>
      resolve({ err, stderr, stdout })
    );
  });
}

async function findLatestVersionOnNpm(packageName) {
  const {err, stdout} = await exec(`npm info --json ${packageName}`);

  if (err) {
    throw err;
  }

  const npmInfo = JSON.parse(stdout);

  return npmInfo['dist-tags'].latest
}

async function latestVersion(packageName) {
  const version = await findLatestVersionOnNpm(packageName);
  return `^${version}`;
}

async function fileExists(path) {
  const resolvedPath = resolveFromRoot(path);

  try {
    await fs.stat(resolvedPath);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") {
      return false;
    }
    throw e;
  }
}

const TEMPLATE_DIR = resolveFromRoot('templates')

async function template(file, data = {}) {
  const templatePath = path.resolve(TEMPLATE_DIR, file);
  let content = await fs.readFile(templatePath, 'utf-8');
  return miniEjs(content, data);
}

async function loadPackageJson() {
  const contents = await fs.readFile(resolveFromRoot("package.json"), "utf-8");
  return JSON.parse(contents);
}

async function savePackageJson(contents) {
  const serialized = JSON.stringify(contents, null, 2);
  return fs.writeFile(resolveFromRoot("package.json"), serialized);
}

function sortObjectKeys(obj) {
  return Object.keys(obj)
    .sort((a, b) => a.localeCompare(b))
    .reduce((newObj, key) => {
      newObj[key] = obj[key];
      return newObj;
    }, {});
}

async function packageJsonHasDevDependency(name) {
  const packageJson = await loadPackageJson();

  if (packageJson.devDependencies) {
    return packageJson.devDependencies[name];
  }

  return false;
}

function spawn(command, args, opts) {
  return new Promise((resolve, reject) => {
    childProcess
      .spawn(command, args, {
        stdio: ["pipe", process.stdout, process.stderr],
        ...opts
      })
      .on("error", err => reject(err))
      .on("close", code => {
        if (code === 0) {
          return resolve();
        }
        const err = new Error(`Non zero exit code: ${code}`);
        return reject(err);
      });
  });
}

async function npmInstallDev(...packages) {
  const pkgJson = await loadPackageJson();

  pkgJson.devDependencies = pkgJson.devDependencies || {};

  for (const package of packages) {
    pkgJson.devDependencies[package] = await latestVersion(package);
  }

  pkgJson.devDependencies = sortObjectKeys(pkgJson.devDependencies);

  await savePackageJson(pkgJson);
}

async function npmInit(shouldBeEsmSyntax) {
  const content = await template('package.json.ejs', {
    folderName: path.basename(resolveFromRoot()),
    shouldBeEsmSyntax
  });
  await fs.writeFile(resolveFromRoot('package.json'), content, 'utf-8');
}

async function installEslintAndPrettier(shouldBeEsmSyntax) {
  if (await packageJsonHasDevDependency("eslint")) {
    console.error("Skipping eslint installation: Already installed");
  } else {
    await npmInstallDev(
      "prettier",
      "eslint",
      "eslint-plugin-import",
      "globals"
    );

    const pkgJson = await loadPackageJson();
    pkgJson.scripts = pkgJson.scripts || {};
    pkgJson.scripts.lint = "eslint . && prettier --check '**/*.js'";
    pkgJson.scripts = sortObjectKeys(pkgJson.scripts);
    await savePackageJson(pkgJson);

    const eslintConfPath = resolveFromRoot('eslint.config.js');

    let content = await template('eslint.config.js.ejs', { shouldBeEsmSyntax });

    await fs.writeFile(eslintConfPath, content, 'utf-8')
  }
}

async function setupTesting() {
  await npmInstallDev(
    "unexpected",
    "mocha",
    "c8"
  );

  const pkgJson = await loadPackageJson();
  pkgJson.scripts = sortObjectKeys({
    ...pkgJson.scripts,
    test: "mocha",
    coverage: "c8 --reporter=text --reporter=html --all --include lib npm test"
  });
  await savePackageJson(pkgJson);
}

async function nvmInit() {
  if (await fileExists(".nvmrc")) {
    console.error("Skipping nvm configuration: Already configured");
  } else {
    if (process.env.NVM_DIR) {
      const nvmFile = resolveFromRoot(".nvmrc");
      const nodeVersion = process.version.replace(/^v/, "");
      await fs.writeFile(nvmFile, nodeVersion);
    } else {
      console.error("Skipping nvm configuration: nvm not found.");
    }
  }
}

async function gitInit() {
  if (await fileExists(".git")) {
    console.error("Already in a git repo.");
  } else {
    return spawn("git", ["init"]);
  }
}

const kebabToCamel = (name) => name
  .split(/[-_]/)
  .reduce((acc, el, index) => {
    const part = index === 0
      ? el
      : el.charAt(0).toUpperCase() + el.slice(1)
    return acc + part;
  }, "");

async function touchEntryPointFiles(shouldBeEsmSyntax, preferCamel = false) {
  const pkgJson = await loadPackageJson();
  const name = pkgJson.name;

  const camelCasedName = kebabToCamel(name);

  const libDir = resolveFromRoot('lib');
  const testDir = resolveFromRoot('test');

  await fs.mkdir(libDir);
  await fs.mkdir(testDir);

  const fileName = preferCamel ? camelCasedName : name;

  let templateData = {
    shouldBeEsmSyntax,
    MODULE_NAME: camelCasedName,
    MODULE_FILENAME: fileName
  };

  let templateContent = await template(
     "lib/entry.js.ejs",
    templateData
  );

  let testTemplateContent = await template(
    "test/entry.test.js.ejs",
    templateData
  );

  await fs.writeFile(resolveFromRoot(`lib/${fileName}.js`), templateContent, "utf-8");
  await fs.writeFile(resolveFromRoot(`test/${fileName}.test.js`), testTemplateContent, "utf-8");

  pkgJson.main = `lib/${fileName}.js`;

  await savePackageJson(pkgJson);
}

async function setupVsCode(shouldBeEsmSyntax) {
  fs.mkdirSync(resolveFromRoot(".vscode"));
  const settingsPath = resolveFromRoot(".vscode/settings.json");
  const gitignorePath = resolveFromRoot(".gitignore");

  const settings = { "editor.formatOnSave": true };

  if (shouldBeEsmSyntax) {
    settings["javascript.preferences.importModuleSpecifierEnding"] = "js";
  }

  const contents = JSON.stringify(settings, null, 4) + "\n";
  await fs.writeFile(settingsPath, contents, "utf-8");

  const gitignoreContent = "\n# VS Code User Specific Settings\n/.vscode/settings.json\n";
  await fs.appendFile(gitignorePath, gitignoreContent, "utf-8");
}

async function selfRemove() {
  const { SKIPREMOVAL } = process.env;

  console.error("Removing bootstrap script.");

  if (SKIPREMOVAL) {
    console.error("Skipping removal of: %s", __filename);
  } else {
    await fs.rm(__filename);
    await fs.rm(resolveFromRoot('templates'), { recursive: true });
    await fs.rm(resolveFromRoot('_lib'), { recursive: true });
    // Remove the usage notes in README.md
    await fs.writeFile(resolveFromRoot("README.md"), "");
  }
}

async function main() {
  let shouldBeEsmSyntax = true;
  if (process.argv.includes('--cjs')) {
    shouldBeEsmSyntax = false;
  }

  await npmInit(shouldBeEsmSyntax);
  await installEslintAndPrettier(shouldBeEsmSyntax);
  await setupTesting();
  await nvmInit();
  await gitInit();

  if (!process.argv.includes('--no-touch') || !process.argv.includes('--skip-touch')) {
    const preferCamelCaseForFileNames = process.argv.includes('--camel');
    await touchEntryPointFiles(shouldBeEsmSyntax, preferCamelCaseForFileNames);
  }

  if (process.argv.includes('--vscode')) {
    await setupVsCode(shouldBeEsmSyntax);
  }

  await selfRemove();
}

main().then(
  () => {
    console.error("Bootstrap completed. Now install dependencies with npm.");
  },
  err => {
    console.error("An error happened. Try running the script again.\n");
    console.error(err.stack);

    process.exit(1);
  }
);
