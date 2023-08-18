import { join } from "path";
import { emitTestFile, parseTypeScriptFile } from "./generate-test";
import * as fs from "fs";
import { must } from "asl-puml";
import { describe, it, expect } from "vitest";

describe("tests the generation of units tests from mock config", () => {
  it("should extract the details from mockconfig", async () => {
    expect.hasAssertions();

    const outFile = join(__dirname, "../example-crm/crm-comment.asl.test.ts");

    const { found, mockConfigTypeArgs, stateMachines, decl } =
      parseTypeScriptFile(
        join(__dirname, "../example-crm/crm-comment.mock.ts")
      );
    must(found, "not found");
    must(mockConfigTypeArgs, "not type args");
    must(stateMachines, "no state machines");
    const output = await emitTestFile({
      testCases: stateMachines["crm-comment"] as string[],
      aslSourcePath: "../../src/example-crm/crm-comment.asl.json",
      mockConfigSrcFile: "./crm-comment.mock",
      mockConfigTypeArgs,
      mockConfig: decl,
      aslTestRunnerPath: "../lib/runner",
      esm: false,
    });
    expect(output).toBeDefined();
    fs.writeFileSync(outFile, output, "utf-8");
  });
});
