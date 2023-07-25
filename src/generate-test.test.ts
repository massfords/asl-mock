import { join } from "path";
import { parseTypeScriptFile } from "./generate-test";

describe("tests the generation of units tests from mock config", () => {
  it("should extract the details from mockconfig", () => {
    expect.hasAssertions();
    const result = parseTypeScriptFile(
      join(__dirname, "./example-crm/crm-comment.mock.ts")
    );
    console.log(JSON.stringify(result, null, 2));
    expect(result).toMatchSnapshot();
  });
});
