Run `node bootstrap.js` to finish the setup.

You can pass the following options to the boostrap script:

- `--cjs`: Will create files using commonjs syntax.
- `--no-touch`: Will skip creating a main entry point file in the lib folder,
  and a corresponding test file.
- `--camel`: When used it will use camelCasing for the files created.
- `--vscode`: Will generate a simple vscode config dir, enabling auto
formatting, and gitignore it.
