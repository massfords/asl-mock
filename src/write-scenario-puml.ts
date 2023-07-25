import { asl_to_puml, AslDefinition, UserSpecifiedConfig } from "asl-puml";
import invariant from "tiny-invariant";
import fs from "fs";
import path from "path";
import { HistoryEvent, HistoryEventType } from "@aws-sdk/client-sfn";

type StateExecution = {
  // stateEnteredEventDetails.name
  name: string;
  // stateExitedEventDetails hint for status
  result: "error" | "ok" | null;
  isTask: boolean;
};
const TASK_COLOR = "#2b665e";
const OTHER_COLOR = "#86ea9f";
const ERROR_COLOR = "#red";

const themeFromHistory = (history: HistoryEvent[]): UserSpecifiedConfig => {
  const states = getStateResults(history);
  console.log("computing theme", { states });
  return {
    theme: {
      lines: {
        deadPath: {
          color: "#lightgray",
        },
      },
      wrapStateNamesAt: 15,
      stateStyles: [
        ...states.map(({ result, name, isTask }) => {
          return {
            pattern: `^${name.replace("?", "\\?")}$`,
            color:
              result === "ok"
                ? isTask
                  ? TASK_COLOR
                  : OTHER_COLOR
                : ERROR_COLOR,
          };
        }),
        {
          pattern: "^.*$",
          color: "#whitesmoke",
          deadPath: true,
        },
      ],
    },
  };
};

export const writeScenarioPuml = ({
  scenario,
  definition,
  dir,
  history,
}: {
  definition: AslDefinition;
  scenario: string;
  dir: string;
  history: HistoryEvent[];
}): void => {
  const theme: UserSpecifiedConfig = themeFromHistory(history);
  const result = asl_to_puml(definition, theme);
  invariant(result.isValid);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const scenarioFile = path.join(dir, `${scenario}.puml`);
  fs.writeFileSync(scenarioFile, result.puml, "utf-8");
};

const getStateResults = (history: HistoryEvent[]): StateExecution[] => {
  // const executions = []
  // map the state to its execution status
  // initialize the value to error and set it when we see its exit
  const map = new Map<string, "error" | "ok">();
  history.forEach((evt) => {
    if (evt.stateEnteredEventDetails?.name) {
      map.set(evt.stateEnteredEventDetails.name, "error");
    } else if (evt.stateExitedEventDetails?.name) {
      map.set(evt.stateExitedEventDetails.name, "ok");
    }
  });
  return history
    .filter((evt) => evt.stateEnteredEventDetails?.name)
    .map((evt) => {
      invariant(evt.stateEnteredEventDetails?.name);
      return {
        name: evt.stateEnteredEventDetails.name,
        result: map.get(evt.stateEnteredEventDetails.name) ?? null,
        isTask: evt.type === HistoryEventType.TaskStateEntered,
      };
    });
};
