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

import type { MockConfigFile } from "./types";
import type { AslDefinition } from "asl-puml";
import { writeScenarioPuml } from "./write-scenario-puml";
import { must } from "asl-puml";
import { log } from "../logger.js";
import { ExpectStatic } from "vitest";

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
  CustomErrors extends string = string,
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
    >,
  ) {
    this.configFile = `${os.tmpdir()}/MockConfigFile.json`;
    fs.writeFileSync(
      this.configFile,
      JSON.stringify(this.mockConfigFile),
      "utf-8",
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
    CustomErrors extends string = string,
  >(
    mockConfigFile: MockConfigFile<
      StateMachineName,
      TestNames,
      StateNames,
      MockedResponseNames,
      CustomErrors
    >,
    aslJsonFiles: Record<StateMachineName, string>,
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
    log("init client");
    this.startedContainer = await this.testContainer.start();
    console.log("container started");
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
        log("able to list state machines");
        success += 1;
        break;
      } catch (err: unknown) {
        // ignore errors while the app is starting
        log("error while listing, will retry", { err });
      }
      await delay("waiting for events", attempt * 250);
      attempt += 1;
    }
    must(success === 1, "unable to connect to service");
    log("client initialized");
  }

  private async deployStateMachine({
    definition,
    name,
  }: {
    definition: string;
    name: string;
  }): Promise<string> {
    log("deploy state machine", name);
    must(this.client, "call initClient before deploying");
    const result = await this.client.send(
      new CreateStateMachineCommand({
        name,
        definition,
        roleArn: "arn:aws:iam::012345678901:role/DummyRole",
      }),
    );
    must(result.stateMachineArn, "expected fsm to be deployed");
    this.deployments[name] = {
      stateMachineArn: result.stateMachineArn,
      definition,
    };
    return result.stateMachineArn;
  }

  getDefinition(name: StateMachineName): string {
    const deployment = this.deployments[name];
    must(deployment, "unknown fsm name");
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
    log("awaiting completion of execution");
    must(this.client, "client not set");
    let machineOutput: DescribeExecutionOutput | null = null;
    while (!machineOutput || machineOutput.status == "RUNNING") {
      machineOutput = await this.client.send(
        new DescribeExecutionCommand({
          executionArn,
        }),
      );
    }

    const executionHistory = await this.client.send(
      new GetExecutionHistoryCommand({
        executionArn,
        maxResults: 1000,
        includeExecutionData: true,
      }),
    );
    // logger.debug(`execution history for ${executionArn}`, { executionHistory })
    this.history = executionHistory.events ?? [];
  }

  executionSucceeded(): boolean {
    const found = this.history.find(
      (event) => event.type === "ExecutionSucceeded",
    );
    return Boolean(found);
  }

  async execute(
    {
      scenario,
      startMessage,
      name,
      expect,
    }: {
      startMessage: unknown;
      scenario: TestNames;
      name: StateMachineName;
      expect: ExpectStatic;
    },
    afterCompletion: {
      logThisTaskInputOnFailure?: StateNames;
      logHistoryEventsOnFailure?: boolean;
      expectTaskSnapshots?: boolean;
      puml?: string;
    } = { logHistoryEventsOnFailure: true, expectTaskSnapshots: true },
  ): Promise<string> {
    must(this.client, "client not set");
    const { stateMachineArn } = this.deployments[name] as {
      stateMachineArn: string;
    };
    must(stateMachineArn, "fsm not deployed");
    let executionArn: string | null = null;
    try {
      const response = await this.client.send(
        new StartExecutionCommand({
          name: scenario,
          stateMachineArn: `${stateMachineArn}#${scenario}`,
          input: JSON.stringify(startMessage),
        }),
      );
      executionArn = response.executionArn ?? null;
    } catch (err: unknown) {
      console.error("failed to launch", { err });
      throw err;
    }
    must(executionArn, "expected fsm execution started");
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
        const taskFailureInput: { error?: { Cause: string } } | null =
          this.getTaskParameters(logThisTaskInputOnFailure).find((out) => {
            return (
              "error" in out &&
              "Cause" in (out["error"] as Record<string, unknown>)
            );
          }) ?? null;
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
      must(executionSucceeded, "fsm execution failed");
      if (expectTaskSnapshots) {
        this.expectTaskSnapshots({ scenario, name, expect });
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
    options?: { path?: string | null } | null,
  ): Array<Record<string, unknown>> {
    must(this.history, "execute the fsm first");

    const stateEnteredEvents = this.history.filter((evt) => {
      return (
        evt.stateEnteredEventDetails &&
        evt.stateEnteredEventDetails.name === taskName
      );
    });

    return stateEnteredEvents
      .map((evt) => {
        return this.history.find((e) => {
          return e.previousEventId === evt.id && e.taskScheduledEventDetails;
        });
      })
      .filter((evt) => !!evt)
      .map(
        (evt) =>
          evt as HistoryEvent & {
            taskScheduledEventDetails: NonNullable<
              HistoryEvent["taskScheduledEventDetails"]
            >;
          },
      )
      .map((evt) => {
        const taskInput = JSON.parse(
          evt.taskScheduledEventDetails.parameters as string,
        ) as Record<string, unknown>;
        if (options?.path) {
          return JSONPath<Record<string, unknown>>({
            path: options.path,
            json: taskInput,
            flatten: true,
            wrap: false,
          });
        }
        return taskInput;
      });
  }

  getHistoryEvents(): HistoryEvent[] {
    return this.history;
  }

  expectTaskSnapshots({
    scenario,
    name,
    expect,
  }: {
    scenario: TestNames;
    name: StateMachineName;
    expect: ExpectStatic;
  }): void {
    const fsm = this.mockConfigFile.StateMachines[name];
    must(fsm);
    const tasks = fsm.TestCases[scenario];
    must(tasks);
    const assertions: TaskAssertion<StateNames>[] = Object.keys(tasks).map(
      (sn) => {
        const stateName = sn as StateNames;
        return { stateName };
      },
    );

    assertions.forEach((assertion) => {
      const taskInputs = this.getTaskParameters(
        assertion.stateName,
        assertion.options ?? null,
      );
      taskInputs.forEach((taskInput) => {
        expect(taskInput).toMatchSnapshot(
          {
            ...(assertion?.propertyMatcher ?? {}),
          },
          `${assertion.stateName}${assertion.label ?? ""}`,
        );
      });
    });
  }
}
