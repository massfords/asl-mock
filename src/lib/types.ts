type MockedResponseNumber = string;
export type ASLErrorName =
  | "States.BranchFailed"
  | "States.DataLimitExceeded"
  | "States.ExceedToleratedFailureThreshold"
  | "States.HeartbeatTimeout"
  | "States.IntrinsicFailure"
  | "States.ItemReaderFailed"
  | "States.NoChoiceMatched"
  | "States.ParameterPathFailure"
  | "States.Permissions"
  | "States.ResultPathMatchFailure"
  | "States.ResultWriterFailed"
  | "States.Runtime"
  | "States.TaskFailed"
  | "States.Timeout"
  | "Lambda.AWSLambdaException"
  | "Lambda.SdkClientException"
  | "Lambda.ServiceException";

// Return is represented as a field of the MockedResponse objects. It specifies the
// successful result of a mocked Task state.
// cited from: https://docs.aws.amazon.com/step-functions/latest/dg/sfn-local-mock-cfg-file.html#mock-cfg-sm-sect
export type MockedReturn<T = unknown> = {
  Return: T;
};

// Throw is represented as a field of the MockedResponse objects. It specifies the error
// output of a failed Task. The value of Throw must be an object containing an Error
// and Cause fields with string values. In addition, the string value you specify in
// Error field in the MockConfigFile.json must match the errors handled in the Retry
// and Catch sections of your state machine.
// cited from: https://docs.aws.amazon.com/step-functions/latest/dg/sfn-local-mock-cfg-file.html#mock-cfg-sm-sect
export type MockedThrow<
  ErrorName extends string = ASLErrorName,
  ErrorCause extends string = string
> = {
  Throw: { Error: ErrorName; Cause: ErrorCause };
};

export type MockedResponseBehavior<CustomErrorTypes extends string = string> =
  | MockedReturn
  | MockedThrow<ASLErrorName | CustomErrorTypes>;

export type MockConfigFile<
  StateMachineName extends string = string,
  TestCaseName extends string = string,
  StateName extends string = string,
  MockedResponseName extends string = string,
  CustomErrorTypes extends string = string
> = {
  // The StateMachines object defines which state machines will use
  // mocked service integrations. The configuration for each state
  // machine is represented as a top-level field of StateMachines.
  // The field name is the name of the state machine and value is an
  // object containing a single field named TestCases, whose fields
  // represent test cases of that state machine.
  // cited from: https://docs.aws.amazon.com/step-functions/latest/dg/sfn-local-mock-cfg-file.html#mock-cfg-sm-sect
  StateMachines: Record<
    StateMachineName,
    {
      // The fields of TestCases represent individual test cases for the state machine.
      // The name of each test case must be unique per state machine and the value of
      // each test case is an object specifying a mocked response to use for Task
      // states in the state machine.
      // see AWS docs link at top for src
      // cited from: https://docs.aws.amazon.com/step-functions/latest/dg/sfn-local-mock-cfg-file.html#mock-cfg-sm-sect
      TestCases: Partial<
        Record<TestCaseName, Partial<Record<StateName, MockedResponseName>>>
      >;
    }
  >;
  // MockedResponses is an object containing multiple mocked response objects with
  // unique field names. A mocked response object defines the successful result or
  // error output for each invocation of a mocked Task state. You specify the
  // invocation number using individual integer strings, such as “0”, “1”, “2”,
  // and “3” or an inclusive range of integers, such as “0-1”, “2-3”.
  //
  // When you mock a Task, you must specify a mocked response for every invocation.
  // A response must contain a single field named Return or Throw whose value
  // is the result or error output for the mocked Task invocation. If you do not
  // specify a mocked response, the state machine execution will fail.
  // see AWS docs link at top for src
  // cited from: https://docs.aws.amazon.com/step-functions/latest/dg/sfn-local-mock-cfg-file.html#mock-cfg-sm-sect
  MockedResponses: Record<
    MockedResponseName,
    Record<MockedResponseNumber, MockedResponseBehavior<CustomErrorTypes>>
  >;
};
