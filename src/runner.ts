import fs from "fs";
import os from "os";

import type {
  DescribeExecutionOutput,
  HistoryEvent,
} from "@aws-sdk/client-sfn";
import {
  CreateStateMachineCommand,
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
  ListStateMachinesCommand,
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";
import { JSONPath } from "jsonpath-plus";

import type { StartedTestContainer, TestContainer } from "testcontainers";
import { GenericContainer } from "testcontainers";

import invariant from "tiny-invariant";
import type { MockConfigFile } from "./types";
import type { AslDefinition } from "asl-puml";
import { writeScenarioPuml } from "./write-scenario-puml";

const delay = async (message: string, time: number): Promise<void> => {
  await new Promise((resolve) => {
    console.debug(message);
    setTimeout(resolve, time);
  });
};

const port = 8083;

export type TaskAssertion<StateNames extends string> = {
  stateName: StateNames;
  label?: string;
  propertyMatcher?: unknown;
  options?: { path: string } | null;
};

export class AslTestRunner<
  StateMachineName extends string,
  TestNames extends string,
  StateNames extends string,
  MockedResponseNames extends string = string,
  CustomErrors extends string = string
> {
  private readonly configFile: string;
  private startedContainer: StartedTestContainer | null = null;
  private client: SFNClient | null = null;
  private testContainer: TestContainer;
  private history: HistoryEvent[] = [];
  private deployments: Record<
    string,
    { stateMachineArn: string; definition: string }
  > = {};

  private constructor(
    private mockConfigFile: MockConfigFile<
      StateMachineName,
      TestNames,
      StateNames,
      MockedResponseNames,
      CustomErrors
    >
  ) {
    this.configFile = `${os.tmpdir()}/MockConfigFile.json`;
    fs.writeFileSync(
      this.configFile,
      JSON.stringify(this.mockConfigFile),
      "utf-8"
    );
    const configFileInDocker = "/home/StepFunctionsLocal/MockConfigFile.json";
    this.testContainer = new GenericContainer("amazon/aws-stepfunctions-local")
      .withBindMounts([
        {
          mode: "ro",
          source: this.configFile,
          target: configFileInDocker,
        },
      ])
      .withEnvironment({
        SFN_MOCK_CONFIG: configFileInDocker,
        WAIT_TIME_SCALE: "0",
      })
      .withExposedPorts(port);
  }

  static async createRunner<
    StateMachineName extends string,
    TestNames extends string,
    StateNames extends string,
    MockedResponseNames extends string = string,
    CustomErrors extends string = string
  >(
    mockConfigFile: MockConfigFile<
      StateMachineName,
      TestNames,
      StateNames,
      MockedResponseNames,
      CustomErrors
    >,
    aslJsonFiles: Record<StateMachineName, string>
  ): Promise<
    AslTestRunner<
      StateMachineName,
      TestNames,
      StateNames,
      MockedResponseNames,
      CustomErrors
    >
  > {
    const runner = new AslTestRunner(mockConfigFile);
    await runner.initClient();
    for (const [name, src] of Object.entries<string>(aslJsonFiles)) {
      const definition = fs.readFileSync(src, "utf-8");
      await runner.deployStateMachine({ definition, name });
    }
    return runner;
  }

  private async initClient(): Promise<void> {
    this.startedContainer = await this.testContainer.start();
    const mappedPort = this.startedContainer.getMappedPort(port);
    const endpoint = `http://localhost:${mappedPort}`;
    this.client = new SFNClient({
      endpoint,
      region: "us-east-1",
      credentials: { accessKeyId: "dummy", secretAccessKey: "dummy" },
    });
    // stay here until we get a good response back
    let attempt = 1;
    let success = 0;
    while (attempt < 10) {
      try {
        await this.client.send(new ListStateMachinesCommand({}));
        success += 1;
        break;
      } catch {
        // ignore errors while the app is starting
      }
      await delay("waiting for events", attempt * 250);
      attempt += 1;
    }
    invariant(success === 1, "unable to connect to service");
  }

  private async deployStateMachine({
    definition,
    name,
  }: {
    definition: string;
    name: string;
  }): Promise<string> {
    invariant(this.client, "call initClient before deploying");
    const result = await this.client.send(
      new CreateStateMachineCommand({
        name,
        definition,
        roleArn: "arn:aws:iam::012345678901:role/DummyRole",
      })
    );
    invariant(result.stateMachineArn, "expected fsm to be deployed");
    this.deployments[name] = {
      stateMachineArn: result.stateMachineArn,
      definition,
    };
    return result.stateMachineArn;
  }

  getDefinition(name: StateMachineName): string {
    const deployment = this.deployments[name];
    invariant(deployment, "unknown fsm name");
    return deployment.definition;
  }

  async stop(): Promise<void> {
    if (this.startedContainer) {
      await this.startedContainer.stop();
    }
    fs.unlinkSync(this.configFile);
  }

  reset(): void {
    this.history = [];
  }

  async awaitCompletion(executionArn: string): Promise<void> {
    invariant(this.client, "client not set");
    let machineOutput: DescribeExecutionOutput | null = null;
    while (!machineOutput || machineOutput.status == "RUNNING") {
      machineOutput = await this.client.send(
        new DescribeExecutionCommand({
          executionArn,
        })
      );
    }

    const executionHistory = await this.client.send(
      new GetExecutionHistoryCommand({
        executionArn,
        maxResults: 1000,
        includeExecutionData: true,
      })
    );
    // logger.debug(`execution history for ${executionArn}`, { executionHistory })
    this.history = executionHistory.events ?? [];
  }

  executionSucceeded(): boolean {
    const found = this.history.find(
      (event) => event.type === "ExecutionSucceeded"
    );
    return Boolean(found);
  }

  async execute(
    {
      scenario,
      startMessage,
      name,
    }: {
      startMessage: unknown;
      scenario: TestNames;
      name: StateMachineName;
    },
    afterCompletion: {
      logThisTaskInputOnFailure?: StateNames;
      logHistoryEventsOnFailure?: boolean;
      expectTaskSnapshots?: boolean;
      puml?: string;
    } = { logHistoryEventsOnFailure: true, expectTaskSnapshots: true }
  ): Promise<string> {
    invariant(this.client, "client not set");
    const { stateMachineArn } = this.deployments[name] as {
      stateMachineArn: string;
    };
    invariant(stateMachineArn, "fsm not deployed");
    let executionArn: string | null = null;
    try {
      const response = await this.client.send(
        new StartExecutionCommand({
          name: scenario,
          stateMachineArn: `${stateMachineArn}#${scenario}`,
          input: JSON.stringify(startMessage),
        })
      );
      executionArn = response.executionArn ?? null;
    } catch (err: unknown) {
      console.error("failed to launch", { err });
      throw err;
    }
    invariant(executionArn, "expected fsm execution started");
    if (afterCompletion) {
      await this.awaitCompletion(executionArn);
      const {
        logHistoryEventsOnFailure,
        logThisTaskInputOnFailure,
        expectTaskSnapshots,
        puml,
      } = afterCompletion;
      const executionSucceeded = this.executionSucceeded();
      if (!executionSucceeded && logThisTaskInputOnFailure) {
        const taskFailureInput: { error?: { Cause?: string } } =
          this.getTaskParameters(logThisTaskInputOnFailure);
        if (taskFailureInput) {
          console.error(logThisTaskInputOnFailure, {
            taskFailureInput,
            Cause: taskFailureInput.error?.Cause,
          });
        }
      }
      if (!executionSucceeded && logHistoryEventsOnFailure) {
        console.error("fsm failed", { events: this.getHistoryEvents() });
      }
      invariant(executionSucceeded, "fsm execution failed");
      if (expectTaskSnapshots) {
        this.expectTaskSnapshots({ scenario, name });
      }
      if (puml) {
        writeScenarioPuml({
          scenario,
          definition: JSON.parse(this.getDefinition(name)) as AslDefinition,
          dir: puml,
          history: this.getHistoryEvents(),
        });
      }
    }
    return executionArn;
  }

  getTaskParameters(
    taskName: StateNames,
    options?: { which?: number; path?: string | null } | null
  ): Record<string, unknown> {
    invariant(this.history, "execute the fsm first");
    // find the entered state for this task
    let count = 0;
    let matchedId = -1;
    const stopOn = Number(options?.which ?? 1);
    const scheduled = this.history.find((evt) => {
      if (evt.stateEnteredEventDetails?.name === taskName) {
        count += 1;
        if (count === stopOn && matchedId === -1 && evt.id) {
          matchedId = evt.id;
        }
      }
      invariant(count <= stopOn, "task execution not found");
      if (
        count === stopOn &&
        matchedId === evt.previousEventId &&
        evt.taskScheduledEventDetails
      ) {
        invariant(
          evt.taskScheduledEventDetails.parameters,
          "expected task parameters"
        );
        return true;
      }
      return false;
    });
    invariant(
      scheduled?.taskScheduledEventDetails?.parameters,
      `task parameters not found for ${taskName}`
    );
    const taskInput = JSON.parse(
      scheduled.taskScheduledEventDetails.parameters
    ) as Record<string, unknown>;
    if (options?.path) {
      return JSONPath({
        path: options.path,
        json: taskInput,
        flatten: true,
        wrap: false,
      });
    }
    return taskInput;
  }

  getHistoryEvents(): HistoryEvent[] {
    return this.history;
  }

  expectTaskSnapshots({
    scenario,
    name,
  }: {
    scenario: TestNames;
    name: StateMachineName;
  }): void {
    const fsm = this.mockConfigFile.StateMachines[name];
    invariant(fsm);
    const tasks = fsm.TestCases[scenario];
    invariant(tasks);
    const assertions: TaskAssertion<StateNames>[] = Object.keys(tasks).map(
      (sn) => {
        const stateName = sn as StateNames;
        return { stateName };
      }
    );

    assertions.forEach((assertion) => {
      expect(
        this.getTaskParameters(assertion.stateName, assertion.options ?? null)
      ).toMatchSnapshot(
        {
          ...(assertion?.propertyMatcher ?? {}),
        },
        `${assertion.stateName}${assertion.label ?? ""}`
      );
    });
  }
}
