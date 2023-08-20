// Code generated by asl-mock DO NOT EDIT.
import path from "path";
import { AslTestRunner } from "../lib/runner";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type {
  StateMachineNames,
  TestCases,
  StateNames,
  CustomErrors,
} from "./crm-comment.mock";
import { CrmCommentMock, StartMessages } from "./crm-comment.mock";

describe("tests for crm-comment.asl.json", () => {
  const TIMEOUT = 30 * 1000;
  const outdir = path.join(__dirname, ".asl-puml");

  let _aslRunner: AslTestRunner<
    StateMachineNames,
    TestCases,
    StateNames,
    string,
    CustomErrors
  > | null = null;

  beforeAll(async () => {
    _aslRunner = await AslTestRunner.createRunner<
      StateMachineNames,
      TestCases,
      StateNames,
      string,
      CustomErrors
    >(CrmCommentMock, {
      "crm-comment": path.join(
        __dirname,
        "../../src/example-crm/crm-comment.asl.json",
      ),
    });
  });

  afterEach(() => {
    _aslRunner?.reset();
  });

  afterAll(async () => {
    await _aslRunner?.stop();
  });

  describe("mock config scenarios", () => {
    const afterCompletion = {
      puml: outdir,
      expectTaskSnapshots: true,
      logHistoryEventsOnFailure: true,
    };

    it(
      "scenario HappyPathTest",
      async () => {
        expect.hasAssertions();
        await _aslRunner?.execute(
          {
            name: "crm-comment",
            startMessage: StartMessages["HappyPathTest"],
            scenario: "HappyPathTest",
            expect,
          },
          afterCompletion,
        );
      },
      TIMEOUT,
    );

    it(
      "scenario NegativeSentimentTest",
      async () => {
        expect.hasAssertions();
        await _aslRunner?.execute(
          {
            name: "crm-comment",
            startMessage: StartMessages["NegativeSentimentTest"],
            scenario: "NegativeSentimentTest",
            expect,
          },
          afterCompletion,
        );
      },
      TIMEOUT,
    );

    it(
      "scenario CustomValidationFailedCatchTest",
      async () => {
        expect.hasAssertions();
        await _aslRunner?.execute(
          {
            name: "crm-comment",
            startMessage: StartMessages["CustomValidationFailedCatchTest"],
            scenario: "CustomValidationFailedCatchTest",
            expect,
          },
          afterCompletion,
        );
      },
      TIMEOUT,
    );

    it(
      "scenario ValidationExceptionCatchTest",
      async () => {
        expect.hasAssertions();
        await _aslRunner?.execute(
          {
            name: "crm-comment",
            startMessage: StartMessages["ValidationExceptionCatchTest"],
            scenario: "ValidationExceptionCatchTest",
            expect,
          },
          afterCompletion,
        );
      },
      TIMEOUT,
    );

    it(
      "scenario RetryOnServiceExceptionTest",
      async () => {
        expect.hasAssertions();
        await _aslRunner?.execute(
          {
            name: "crm-comment",
            startMessage: StartMessages["RetryOnServiceExceptionTest"],
            scenario: "RetryOnServiceExceptionTest",
            expect,
          },
          afterCompletion,
        );
      },
      TIMEOUT,
    );
  });
});
