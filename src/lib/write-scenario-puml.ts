import {
  asl_to_puml,
  AslDefinition,
  must,
  UserSpecifiedConfig,
} from "asl-puml";
import fs from "fs";
import path from "path";
import { HistoryEvent, HistoryEventType } from "@aws-sdk/client-sfn";

type StateExecution = {
  // stateEnteredEventDetails.name
  name: string;
  // stateExitedEventDetails hint for status
  results: Array<"error" | "ok">;
  isTask: boolean;
};
const TASK_COLOR = "#2b665e";
const OTHER_COLOR = "#86ea9f";
const ERROR_COLOR = "#red";

const themeFromHistory = (history: HistoryEvent[]): UserSpecifiedConfig => {
  const states = getStateResults(history);
  // console.log("computing theme", { states });
  return {
    theme: {
      lines: {
        deadPath: {
          color: "#lightgray",
        },
      },
      wrapStateNamesAt: 15,
      stateStyles: [
        ...states.map(({ results, name, isTask }) => {
          return {
            pattern: `^${name.replace("?", "\\?")}$`,
            ...(isTask &&
            results.length > 1 &&
            results.includes("error") &&
            results[results.length - 1] === "ok"
              ? {
                  description: results
                    .map((result) =>
                      result === "error"
                        ? "<:warning:>"
                        : "<:white_check_mark:>",
                    )
                    .join(" "),
                }
              : null),
            color:
              results[results.length - 1] === "ok"
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
  must(result.isValid, "invalid diagram", { result });
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const scenarioFile = path.join(dir, `${scenario}.puml`);
  fs.writeFileSync(scenarioFile, result.puml, "utf-8");
};

const findStateName = (history: HistoryEvent[], eventId: number): string => {
  let id = eventId;
  while (id) {
    const event = history.find((evt) => evt.id === id);
    must(event, "failed to find event with id", { id });
    if (event.stateEnteredEventDetails) {
      return event.stateEnteredEventDetails.name as string;
    }
    must(event.previousEventId, "event missing previous id", { event });
    id = event.previousEventId;
  }
  throw Error(`state name not found for ${eventId}`);
};

const getStateResults = (history: HistoryEvent[]): StateExecution[] => {
  // const executions = []
  // map the state to its execution status
  const map = new Map<string, StateExecution>();
  history.forEach((evt) => {
    if (evt.stateEnteredEventDetails?.name) {
      const stateResults = map.get(evt.stateEnteredEventDetails.name) ?? {
        name: evt.stateEnteredEventDetails.name,
        results: [],
        isTask: evt.type === HistoryEventType.TaskStateEntered,
      };
      map.set(evt.stateEnteredEventDetails.name, stateResults);
    } else if (evt.stateExitedEventDetails?.name) {
      const stateResults = map.get(
        evt.stateExitedEventDetails?.name,
      ) as StateExecution;
      stateResults.results.push("ok");
    } else if (evt.taskFailedEventDetails || evt.taskTimedOutEventDetails) {
      const stateName = findStateName(history, evt.previousEventId as number);
      const stateResults = map.get(stateName) as StateExecution;
      stateResults.results.push("error");
    }
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
};
