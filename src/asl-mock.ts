#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { program } from "commander";
import { emitTestFile, parseTypeScriptFile } from "./lib/generate-test.js";
import { setVerboseLogging } from "./logger.js";

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
  .option("--no-esm", "disables esm style imports")
  .option("--no-flat", "flat es lint is enabled by default")
  .option("-v --verbose", "enables verbose logging")
  .parse(process.argv);

function outputFileFromInput(input: string): string {
  if (input.endsWith(".mock.ts")) {
    return input.substring(0, input.length - ".mock.ts".length) + ".test.ts";
  } else {
    return input.substring(0, input.length - ".ts".length) + ".test.ts";
  }
}

async function generateTestFile(): Promise<void> {
  try {
    const opts: {
      input: string;
      asl: string;
      out?: string;
      esm: boolean;
      flat: boolean;
      verbose?: boolean;
    } = program.opts();

    setVerboseLogging(opts.verbose ?? false);

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
    const output = await emitTestFile({
      testCases: Object.values(stateMachines)[0] as string[],
      aslSourcePath: opts.asl,
      mockConfigSrcFile: `./${path.parse(path.basename(opts.input)).name}`,
      mockConfigTypeArgs,
      mockConfig: decl,
      aslTestRunnerPath: "asl-mock",
      esm: opts.esm,
      flatEslint: opts.flat,
    });
    const outputFile = opts.out ?? outputFileFromInput(opts.input);
    fs.writeFileSync(outputFile, output, "utf-8");
    doneValid();
  } catch (e: unknown) {
    fail(
      `asl-mock exception: ${
        (e as { message?: string }).message ?? "no message"
      }`,
    );
    // fail("asl-mock exception:" + JSON.stringify(e));
  }
}

void (async () => {
  await generateTestFile();
})();
