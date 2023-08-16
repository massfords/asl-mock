#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { program } from "commander";
import { emitTestFile, parseTypeScriptFile } from "./lib/generate-test.js";

function doneValid() {
  process.exit(0);
}

function fail(message: string) {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(2);
}

program
  .description("Generate test runner from mock config file")
  .requiredOption("-i --input <input>", "path to mock config ts file")
  .requiredOption("-a --asl <asl>", "relative path to asl src during test")
  .option("-o --out <out>", "path for emitted test file")
  .parse(process.argv);

function outputFileFromInput(input: string): string {
  if (input.endsWith(".mock.ts")) {
    return input.substring(0, input.length - ".mock.ts".length) + ".test.ts";
  } else {
    return input.substring(0, input.length - ".ts".length) + ".test.ts";
  }
}

function generateTestFile(): void {
  try {
    const opts: {
      input: string;
      asl: string;
      out?: string;
    } = program.opts();

    const { found, mockConfigTypeArgs, stateMachines, decl } =
      parseTypeScriptFile(opts.input);
    if (!found) {
      fail("mock config ts file not found");
      return;
    }
    if (!stateMachines) {
      fail("stateMachines not found in mock config");
      return;
    }
    if (!mockConfigTypeArgs) {
      fail("mockConfigTypeArgs not found in mock config");
      return;
    }
    const output = emitTestFile({
      testCases: Object.values(stateMachines)[0] as string[],
      aslSourcePath: opts.asl,
      mockConfigSrcFile: `./${path.parse(path.basename(opts.input)).name}`,
      mockConfigTypeArgs,
      mockConfig: decl,
      aslTestRunnerPath: "asl-mock",
    });
    const outputFile = opts.out ?? outputFileFromInput(opts.input);
    fs.writeFileSync(outputFile, output, "utf-8");
    doneValid();
  } catch (e: unknown) {
    fail("asl-mock exception:" + JSON.stringify(e));
  }
}

generateTestFile();
