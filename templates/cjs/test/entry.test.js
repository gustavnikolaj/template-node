const { describe, it } = require("node:test");
const expect = require("unexpected");
const %%MODULE_NAME%% = require("../lib/%%MODULE_FILENAME%%");

describe("%%MODULE_NAME%%", () => {
  it("should be a function", () => {
    expect(%%MODULE_NAME%%, "to be a function");
  });
});
