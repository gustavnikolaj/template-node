Run `node bootstrap.js` to finish the setup.

You can pass the following options to the boostrap script:

- `--touch`: Will create a main entry point file in the lib folder, and a
  corresponding test file.
- `--camel`: When used along side `--touch` it will use camelCasing for the
  files created.
- `--vscode`: Will generate a simple vscode config dir, enabling auto
  formatting, and gitignore it.
