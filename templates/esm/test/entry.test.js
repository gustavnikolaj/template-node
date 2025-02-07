import { describe, it } from "node:test";
import expect from "unexpected";
import %%MODULE_NAME%% from "../lib/%%MODULE_FILENAME%%.js";

describe("%%MODULE_NAME%%", () => {
  it("should be a function", () => {
    expect(%%MODULE_NAME%%, "to be a function");
  });
});
