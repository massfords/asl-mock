import type { MockConfigFile } from "../lib/types";

export type StateMachineNames = "crm-comment";

export type TestCases =
  | "HappyPathTest"
  | "NegativeSentimentTest"
  | "CustomValidationFailedCatchTest"
  | "ValidationExceptionCatchTest"
  | "RetryOnServiceExceptionTest";

export type StateNames =
  | "Check Identity"
  | "Check Address"
  | "DetectSentiment"
  | "Add to FollowUp"
  | "CustomerAddedToFollowup"
  | "NegativeSentimentDetected"
  | "CustomValidationFailed"
  | "ValidationException";

export type CustomErrors =
  | "CustomValidationError"
  | "CustomAddressValidationError"
  | "InternalServerException";

export const CrmCommentMock: MockConfigFile<
  StateMachineNames,
  TestCases,
  StateNames,
  string,
  CustomErrors
> = {
  StateMachines: {
    "crm-comment": {
      TestCases: {
        HappyPathTest: {
          "Check Identity": "CheckIdentityLambdaMockedSuccess",
          "Check Address": "CheckAddressLambdaMockedSuccess",
          DetectSentiment: "DetectSentimentPositive",
          "Add to FollowUp": "AddToFollowUpSuccess",
          CustomerAddedToFollowup: "CustomerAddedToFollowupSuccess",
        },
        NegativeSentimentTest: {
          "Check Identity": "CheckIdentityLambdaMockedSuccess",
          "Check Address": "CheckAddressLambdaMockedSuccess",
          DetectSentiment: "DetectSentimentNegative",
          NegativeSentimentDetected: "NegativeSentimentDetectedSuccess",
        },
        CustomValidationFailedCatchTest: {
          "Check Identity": "CheckIdentityLambdaMockedThrowError",
          "Check Address": "CheckAddressLambdaMockedSuccess",
          CustomValidationFailed: "CustomValidationFailedPutEventSuccess",
        },
        ValidationExceptionCatchTest: {
          "Check Identity": "CheckIdentityLambdaMockedSuccess",
          "Check Address": "CheckAddressLambdaMockedThrowExceptionSuccess",
          ValidationException: "ValidationExceptionPutEventSuccess",
        },
        RetryOnServiceExceptionTest: {
          "Check Identity": "CheckIdentityLambdaMockedSuccess",
          "Check Address": "CheckAddressLambdaMockedSuccess",
          DetectSentiment: "DetectSentimentRetryOnErrorWithSuccess",
          "Add to FollowUp": "AddToFollowUpSuccess",
          CustomerAddedToFollowup: "CustomerAddedToFollowupSuccess",
        },
      },
    },
  },
  MockedResponses: {
    CheckIdentityLambdaMockedSuccess: {
      "0": {
        Return: {
          StatusCode: 200,
          Payload: {
            statusCode: 200,
            body: '{"approved": true, "message": "identity validation passed"}',
          },
        },
      },
    },
    CheckAddressLambdaMockedSuccess: {
      "0": {
        Return: {
          StatusCode: 200,
          Payload: {
            statusCode: 200,
            body: '{"approved": true, "message": "address validation passed"}',
          },
        },
      },
    },
    AddToFollowUpSuccess: {
      "0": {
        Return: {
          SdkHttpMetadata: {
            HttpStatusCode: 200,
          },
        },
      },
    },
    CustomerAddedToFollowupSuccess: {
      "0": {
        Return: {
          StatusCode: 200,
          Payload: {
            statusCode: 200,
          },
        },
      },
    },
    CheckIdentityLambdaMockedThrowError: {
      "0-3": {
        Throw: {
          Error: "CustomValidationError",
          Cause: "Check Identity Validation Failed",
        },
      },
    },
    CheckAddressLambdaMockedThrowExceptionSuccess: {
      "0": {
        Throw: {
          Error: "CustomAddressValidationError",
          Cause: "Address Validation Exception",
        },
      },
    },
    CustomValidationFailedPutEventSuccess: {
      "0": {
        Return: {
          Payload: {
            Entries: [
              {
                EventId: "abc123",
              },
            ],
            FailedEntryCount: 0,
          },
        },
      },
    },
    ValidationExceptionPutEventSuccess: {
      "0": {
        Return: {
          Payload: {
            Entries: [
              {
                EventId: "abc123",
              },
            ],
            FailedEntryCount: 0,
          },
        },
      },
    },
    DetectSentimentPositive: {
      "0": {
        Return: {
          Sentiment: "POSITIVE",
          SentimentScore: {
            Mixed: 0.00012647535,
            Negative: 0.00008031699,
            Neutral: 0.0051454515,
            Positive: 0.9946478,
          },
        },
      },
    },
    DetectSentimentNegative: {
      "0": {
        Return: {
          Sentiment: "NEGATIVE",
          SentimentScore: {
            Mixed: 0.00012647535,
            Positive: 0.00008031699,
            Neutral: 0.0051454515,
            Negative: 0.9946478,
          },
        },
      },
    },
    NegativeSentimentDetectedSuccess: {
      "0": {
        Return: {
          Payload: {
            Entries: [
              {
                EventId: "abc123",
              },
            ],
            FailedEntryCount: 0,
          },
        },
      },
    },
    DetectSentimentRetryOnErrorWithSuccess: {
      "0-2": {
        Throw: {
          Error: "InternalServerException",
          Cause:
            "Server Exception while calling DetectSentiment API in Comprehend Service",
        },
      },
      "3": {
        Return: {
          Sentiment: "POSITIVE",
          SentimentScore: {
            Mixed: 0.00012647535,
            Negative: 0.00008031699,
            Neutral: 0.0051454515,
            Positive: 0.9946478,
          },
        },
      },
    },
  },
};

const ValidPositiveComment = {
  data: {
    firstname: "Jane",
    lastname: "Doe",
    identity: {
      email: "jdoe@example.com",
      ssn: "123-45-6789",
    },
    address: {
      street: "123 Main St",
      city: "Columbus",
      state: "OH",
      zip: "43219",
    },
    comments:
      "I am glad to sign-up for this service. Looking forward to different options.",
  },
};

export const StartMessages: Record<TestCases, unknown> = {
  HappyPathTest: ValidPositiveComment,
  NegativeSentimentTest: ValidPositiveComment,
  CustomValidationFailedCatchTest: ValidPositiveComment,
  RetryOnServiceExceptionTest: ValidPositiveComment,
  ValidationExceptionCatchTest: ValidPositiveComment,
};
