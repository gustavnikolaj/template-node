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

const fs = require('fs');
const { promisify } = require('util');
const childProcess = require('child_process');
const path = require('path');

const resolveFromRoot = (...args) => path.resolve(__dirname, ...args);
const stat = promisify(fs.stat);
const unlinkFile = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

async function fileExists(path) {
  const resolvedPath = resolveFromRoot(path);

  try {
    await stat(resolvedPath); 
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') {
      return false;
    }
    throw e;
  }
}

async function loadPackageJson() {
  const contents = await readFile(resolveFromRoot('package.json'), 'utf-8');
  return JSON.parse(contents);
}

async function savePackageJson(contents) {
  const serialized = JSON.stringify(contents, null, 2);
  return writeFile(resolveFromRoot('package.json'), serialized);
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
    childProcess.spawn(command, args, { stdio: ['pipe', process.stdout, process.stderr], ...opts })
      .on('error', (err) => reject(err))
      .on('close', (code) => {
        if (code === 0) {
          return resolve();
        }
        const err = new Error(`Non zero exit code: ${code}`);
        return reject(err);
      });
  });
}

function npmInstallDev(...packages) {
  return spawn('npm', [
    'install',
    '--save-dev',
    ...packages
  ]);
}

async function npmInit() {
  if (await fileExists('package.json')) {  
    console.error('Skipping `npm init`, package.json already exists.');
  } else {
    const env = Object.create(process.env);
    env.NPM_CONFIG_INIT_VERSION = '0.0.0';
    await spawn('npm', ['init', '-y'], { env });

    // npm init will default the description to the first line of the README.md
    // if the file exists when it is being run.
    const pkgJson = await loadPackageJson();
    pkgJson.description = '';
    await savePackageJson(pkgJson);
  }
}

async function installPrettier() {
  if (await packageJsonHasDevDependency('prettier')) {
    console.error('Skipping prettier installation: Already installed');
  } else {
    return npmInstallDev('prettier');
  }
}

async function installEslint() {
  if (await packageJsonHasDevDependency('eslint')) {
    console.error('Skipping eslint installation: Already installed');
  } else {
    await npmInstallDev(
      'eslint',
      'eslint-config-pretty-standard',
      'eslint-plugin-import',
      'eslint-plugin-prettier'
    );

    const pkgJson = await loadPackageJson();
    pkgJson.scripts = pkgJson.scripts || {};
    pkgJson.scripts.lint = 'eslint .';
    await savePackageJson(pkgJson);
  }
}

async function selfRemove() {
  const { SKIPREMOVAL } = process.env;
  if (SKIPREMOVAL) {
    console.error('Skipping removal of: %s', __filename);
  } else {
    await unlinkFile(__filename);
    
    let readmeContents = await readFile(resolveFromRoot('README.md'), 'utf-8');

    for (const line of readmeContents.split('\n')) {
      if (/bootstrap\.js/.test(line)) {
        readmeContents = readmeContents.replace(new RegExp(line + '\\s+'), '');
        break;
      }
    }

    await writeFile(resolveFromRoot('README.md'), readmeContents);
  }
}

async function main () {
  await npmInit();
  await installPrettier();
  await installEslint();

  console.error('Removing bootstrap script.');
  await selfRemove();
}

main().then(
  () => console.error('Bootstrap completed.'),
  (err) => {
    console.error('An error happened. Try running the script again.\n');
    console.error(err.stack);

    process.exit(1);
  }
);
