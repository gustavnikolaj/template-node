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

const fs = require("fs");
const { promisify } = require("util");
const childProcess = require("child_process");
const path = require("path");

const resolveFromRoot = (...args) => path.resolve(__dirname, ...args);
const stat = promisify(fs.stat);
const unlinkFile = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

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

async function npmInit() {
  if (await fileExists("package.json")) {
    console.error("Skipping `npm init`, package.json already exists.");
  } else {
    const env = Object.create(process.env);
    env.NPM_CONFIG_INIT_VERSION = "0.0.0";
    await spawn("npm", ["init", "-y"], { env });

    // clean up the package.json file. npm init with the -y flag has some
    // default behavior we don't want to inherit.
    const pkgJson = await loadPackageJson();

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

    await savePackageJson(pkgJson);
  }
}

async function installEslintAndPrettier() {
  if (await packageJsonHasDevDependency("eslint")) {
    console.error("Skipping eslint installation: Already installed");
  } else {
    await npmInstallDev(
      "prettier",
      "eslint",
      "eslint-config-prettier",
      "eslint-config-standard",
      "eslint-plugin-import",
      "eslint-plugin-mocha",
      "eslint-plugin-node",
      "eslint-plugin-promise"
    );

    const pkgJson = await loadPackageJson();
    pkgJson.scripts = pkgJson.scripts || {};
    pkgJson.scripts.lint = "eslint . && prettier --check '**/*.js'";
    pkgJson.scripts = sortObjectKeys(pkgJson.scripts);
    await savePackageJson(pkgJson);
  }
}

async function installMochaAndNyc() {
  if (await packageJsonHasDevDependency("mocha")) {
    console.error("Skipping mocha installation: Already installed");
  } else {
    await npmInstallDev("mocha", "nyc");

    const pkgJson = await loadPackageJson();
    pkgJson.scripts = pkgJson.scripts || {};
    pkgJson.scripts.test = "mocha";
    pkgJson.scripts.coverage = "nyc mocha";
    pkgJson.scripts = sortObjectKeys(pkgJson.scripts);
    pkgJson.mocha = { recursive: true }
    pkgJson.nyc = { cache: true, reporter: ["html", "lcov", "text"] };
    await savePackageJson(pkgJson);
  }
}

async function installUnexpected() {
  if (await packageJsonHasDevDependency("unexpected")) {
    console.error("Skipping unexpected installation: Already installed");
  } else {
    await npmInstallDev("unexpected");
  }
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

async function touchEntryPointFiles(preferCamel = false) {
  const pkgJson = await loadPackageJson();
  const name = pkgJson.name;

  const camelCasedName = kebabToCamel(name);

  const libDir = resolveFromRoot('lib');
  const testDir = resolveFromRoot('test');

  fs.mkdirSync(libDir);
  fs.mkdirSync(testDir);

  const template = `module.exports = function ${camelCasedName}() {};\n`;

  const fileName = preferCamel ? camelCasedName : name;

  const testTemplate = [
    `const expect = require("unexpected");`,
    `const ${camelCasedName} = require("../lib/${fileName}");`,
    "",
    `describe("${fileName}", () => {`,
    `  it("should be a function", () => {`,
    `    expect(${camelCasedName}, "to be a function");`,
    `  });`,
    `});`,
    ""
  ].join("\n");

  fs.writeFileSync(resolveFromRoot(`lib/${fileName}.js`), template, "utf-8");
  fs.writeFileSync(resolveFromRoot(`test/${fileName}.spec.js`), testTemplate, "utf-8");

  pkgJson.main = `lib/${fileName}.js`;

  await savePackageJson(pkgJson);
}

async function setupVsCode() {
  fs.mkdirSync(resolveFromRoot(".vscode"));
  const settingsPath = resolveFromRoot(".vscode/settings.json");
  const gitignorePath = resolveFromRoot(".gitignore");

  const contents = JSON.stringify({ "editor.formatOnSave": true }, null, 4) + "\n";
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
    await unlinkFile(__filename);
    // Remove the usage notes in README.md
    await writeFile(resolveFromRoot("README.md"), "");
  }
}

async function main() {
  await npmInit();
  await installEslintAndPrettier();
  await installMochaAndNyc();
  await installUnexpected();
  await nvmInit();
  await gitInit();

  if (process.argv.includes('--touch')) {
    const preferCamelCaseForFileNames = process.argv.includes('--camel');
    await touchEntryPointFiles(preferCamelCaseForFileNames);
  }

  if (process.argv.includes('--vscode')) {
    await setupVsCode();
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
