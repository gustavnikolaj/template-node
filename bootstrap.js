/*                         PROJECT BOOTSTRAP SCRIPT
 * ============================================================================
 *
 * After copying this template into a new folder, run this script to configure
 * and install dependencies.
 *
 * The script is idempotent so it can be run multiple times if it fails
 * partially or entirely, and it will resume from where ever it made it to.
 *
 * Upon success it will remove itself.
 */

const [major] = process.versions.node.split('.').map(Number);

if (major < 20) {
  throw new Error(
    `Unsupported Node.js version: ${process.version}. Please use Node.js 20 or higher.`
  );
}

const fs = require("fs");
const { stat, readFile, writeFile, rm } = require('node:fs/promises');
const childProcess = require("child_process");
const path = require("path");

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
    await stat(resolvedPath);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") {
      return false;
    }
    throw e;
  }
}

function cjs2esm(str) {
  return str
    .replace(
      /const (\w+) = require\("(.+)"\);/g,
      'import $1 from "$2";'
    )
    .replace(
      /const (\{[\w\s,]*\}) = require\("(.+)"\);/g,
      'import $1 from "$2";'
    )
    .replace("module.exports =", "export default")
}

const TEMPLATE_DIR = resolveFromRoot('templates')

async function template(file, data = {}) {
  const templatePath = path.resolve(TEMPLATE_DIR, file);
  let content = await readFile(templatePath, 'utf-8');

  for (const [key, value] of Object.entries(data)) {
    let keyRegExpEscaped = `[${key.split('').join('][')}]`;
    let regex = new RegExp(`%%${keyRegExpEscaped}%%`, 'g')
    content = content.replace(regex, value);
  }

  return content;
}

async function jsTemplate(shouldBeEsm, file, data) {
  let templatePath = shouldBeEsm ? `esm/${file}` : `cjs/${file}`;
  return template(templatePath, data);
}

async function loadPackageJson() {
  const contents = await readFile(resolveFromRoot("package.json"), "utf-8");
  return JSON.parse(contents);
}

async function savePackageJson(contents) {
  const serialized = JSON.stringify(contents, null, 2);
  return writeFile(resolveFromRoot("package.json"), serialized);
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
  if (await fileExists("package.json")) {
    console.error("Skipping `npm init`, package.json already exists.");
  } else {
    const env = Object.create(process.env);
    env.NPM_CONFIG_INIT_VERSION = "0.0.0";
    await spawn("npm", ["init", "-y"], { env });

    // clean up the package.json file. npm init with the -y flag has some
    // default behavior we don't want to inherit.
    let pkgJson = await loadPackageJson();

    // npm init will default the description to the first line of the README.md
    // if the file exists when it is being run.
    pkgJson.description = "";

    // npm init will default the main property to a seemingly random .js file
    // in the project if it's not empty yet.
    pkgJson.main = "";

    // unset the default test target
    if (pkgJson.scripts && pkgJson.scripts.test) {
      delete pkgJson.scripts.test;
    }

    if (shouldBeEsmSyntax) {
      // Dumb way to set type: module, but if I just add the property
      // directly on the object, it will be added to the top, and I want
      // it after the main property. This was the easy and dumbest way...
      let pkgJsonString = JSON.stringify(pkgJson);
      pkgJsonString = pkgJsonString.replace(
        ',"main":"",',
        ',"main":"","type":"module",'
      );
      pkgJson = JSON.parse(pkgJsonString);
    }

    await savePackageJson(pkgJson);
  }
}

async function installEslintAndPrettier(shouldBeEsmSyntax) {
  if (await packageJsonHasDevDependency("eslint")) {
    console.error("Skipping eslint installation: Already installed");
  } else {
    await npmInstallDev(
      "prettier",
      "eslint",
      "eslint-plugin-import"
    );

    const pkgJson = await loadPackageJson();
    pkgJson.scripts = pkgJson.scripts || {};
    pkgJson.scripts.lint = "eslint . && prettier --check '**/*.js'";
    pkgJson.scripts = sortObjectKeys(pkgJson.scripts);
    await savePackageJson(pkgJson);

    const eslintConfPath = resolveFromRoot('eslint.config.js');

    let content = await jsTemplate(
      shouldBeEsmSyntax,
      'eslint.config.js',
      eslintConfSourceTemplate
    );

    await writeFile(eslintConfPath, content, 'utf-8')
  }
}

async function setupTesting() {
  await npmInstallDev("unexpected");

  const pkgJson = await loadPackageJson();
  pkgJson.scripts = pkgJson.scripts || {};
  pkgJson.scripts.test = "node --test";
  pkgJson.scripts = sortObjectKeys(pkgJson.scripts);
  await savePackageJson(pkgJson);
}

async function nvmInit() {
  if (await fileExists(".nvmrc")) {
    console.error("Skipping nvm configuration: Already configured");
  } else {
    if (process.env.NVM_DIR) {
      const nvmFile = resolveFromRoot(".nvmrc");
      const nodeVersion = process.version.replace(/^v/, "");
      await writeFile(nvmFile, nodeVersion);
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

  fs.mkdirSync(libDir);
  fs.mkdirSync(testDir);

  let template = shouldBeEsmSyntax
    ? `export default function ${camelCasedName}() {}\n`
    : `module.exports = function ${camelCasedName}() {};\n`;

  const fileName = preferCamel ? camelCasedName : name;
  const importName = shouldBeEsmSyntax ? `${fileName}.js` : fileName;

  let testTemplate = [
    `const { describe, it } = require("node:test");`,
    `const expect = require("unexpected");`,
    `const ${camelCasedName} = require("../lib/${importName}");`,
    "",
    `describe("${fileName}", () => {`,
    `  it("should be a function", () => {`,
    `    expect(${camelCasedName}, "to be a function");`,
    `  });`,
    `});`,
    ""
  ].join("\n");

  if (shouldBeEsmSyntax) {
    testTemplate = cjs2esm(testTemplate);
  }

  fs.writeFileSync(resolveFromRoot(`lib/${fileName}.js`), template, "utf-8");
  fs.writeFileSync(resolveFromRoot(`test/${fileName}.spec.js`), testTemplate, "utf-8");

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
  fs.writeFileSync(settingsPath, contents, "utf-8");

  const gitignoreContent = "\n# VS Code User Specific Settings\n/.vscode/settings.json\n";
  fs.appendFileSync(gitignorePath, gitignoreContent, "utf-8");
}

async function selfRemove() {
  const { SKIPREMOVAL } = process.env;

  console.error("Removing bootstrap script.");

  if (SKIPREMOVAL) {
    console.error("Skipping removal of: %s", __filename);
  } else {
    await rm(__filename);
    await rm(resolveFromRoot('templates'), { recursive: true });
    // Remove the usage notes in README.md
    await writeFile(resolveFromRoot("README.md"), "");
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
