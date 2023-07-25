import path from "path";
import { AslTestRunner } from "../runner";
import type {
  CustomErrors,
  StateMachineNames,
  StateNames,
  TestCases,
} from "./crm-comment.mock";
import { CrmCommentMock } from "./crm-comment.mock";
import invariant from "tiny-invariant";
import { ValidPositiveComment } from "./start-messages";

jest.setTimeout(180 * 1000);
describe("tests for crm-comment.asl.json", () => {
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
        "../../src/example-crm/crm-comment.asl.json"
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
      writeScenarioPuml: outdir,
      expectTaskSnapshots: true,
      logHistoryEventsOnFailure: true,
    };

    const nameAndStartMessage: {
      name: StateMachineNames;
      startMessage: unknown;
    } = {
      name: "crm-comment",
      startMessage: ValidPositiveComment,
    };

    it("scenario HappyPathTest", async () => {
      expect.hasAssertions();
      invariant(_aslRunner);
      await _aslRunner.execute(
        {
          ...nameAndStartMessage,
          scenario: "HappyPathTest",
        },
        afterCompletion
      );
    });
    it("scenario NegativeSentimentTest", async () => {
      expect.hasAssertions();
      invariant(_aslRunner);
      await _aslRunner.execute(
        {
          ...nameAndStartMessage,
          scenario: "NegativeSentimentTest",
        },
        afterCompletion
      );
    });
    it("scenario CustomValidationFailedCatchTest", async () => {
      expect.hasAssertions();
      invariant(_aslRunner);
      await _aslRunner.execute(
        {
          ...nameAndStartMessage,
          scenario: "CustomValidationFailedCatchTest",
        },
        afterCompletion
      );
    });
    it("scenario ValidationExceptionCatchTest", async () => {
      expect.hasAssertions();
      invariant(_aslRunner);
      await _aslRunner.execute(
        {
          ...nameAndStartMessage,
          scenario: "ValidationExceptionCatchTest",
        },
        afterCompletion
      );
    });
    it("scenario RetryOnServiceExceptionTest", async () => {
      expect.hasAssertions();
      invariant(_aslRunner);
      await _aslRunner.execute(
        {
          ...nameAndStartMessage,
          scenario: "RetryOnServiceExceptionTest",
        },
        afterCompletion
      );
    });
  });
});
