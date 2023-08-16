import { join } from "path";
import { emitTestFile, parseTypeScriptFile } from "./generate-test";
import * as fs from "fs";
import { must } from "asl-puml";

describe("tests the generation of units tests from mock config", () => {
  it("should extract the details from mockconfig", () => {
    expect.hasAssertions();

    const outFile = join(__dirname, "../example-crm/crm-comment.asl.test.ts");

    const { found, mockConfigTypeArgs, stateMachines, decl } =
      parseTypeScriptFile(
        join(__dirname, "../example-crm/crm-comment.mock.ts")
      );
    must(found, "not found");
    must(mockConfigTypeArgs, "not type args");
    must(stateMachines, "no state machines");
    const output = emitTestFile({
      testCases: stateMachines["crm-comment"] as string[],
      aslSourcePath: "../../src/example-crm/crm-comment.asl.json",
      mockConfigSrcFile: "./crm-comment.mock",
      mockConfigTypeArgs,
      mockConfig: decl,
      aslTestRunnerPath: "../lib/runner",
    });
    expect(output).toBeDefined();
    fs.writeFileSync(outFile, output, "utf-8");
  });
});
