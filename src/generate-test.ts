import ts, {
  createSourceFile,
  isVariableStatement,
  ObjectLiteralExpression,
  PropertyName,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  sys,
} from "typescript";
import { must } from "asl-puml";

interface StateMachines {
  [key: string]: string[];
}

// Function to extract the contents of the TestCases field
const extractTestCasesKeys = (node: ts.ObjectLiteralExpression): string[] => {
  const keys: string[] = [];

  // Traverse the properties of the ObjectLiteralExpression
  for (const prop of node.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === "TestCases"
    ) {
      const testCasesObject = prop.initializer;
      if (ts.isObjectLiteralExpression(testCasesObject)) {
        for (const member of testCasesObject.properties) {
          if (ts.isPropertyAssignment(member)) {
            keys.push(member.name.getText());
          }
        }
      }
    }
  }

  return keys;
};

// Function to find an exported const of type 'MockConfigFile'
const findExportedMockConfigFile = (
  node: ts.Node
): {
  found: boolean;
  mockConfigTypeArgs?: string[];
  stateMachines?: StateMachines;
  decl: string;
} => {
  const stateMachinesObject: StateMachines = {};
  const mockConfigTypeArgs: string[] = [];
  let declName = "";
  ts.forEachChild(node, (n): void => {
    if (
      isVariableStatement(n) &&
      n.modifiers?.some((m) => m.kind === SyntaxKind.ExportKeyword)
    ) {
      for (const decl of n.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.type &&
          ts.isTypeReferenceNode(decl.type)
        ) {
          const typeName = decl.type.typeName.getText();
          if (
            typeName === "MockConfigFile" &&
            decl.initializer &&
            "properties" in decl.initializer
          ) {
            declName = decl.name.getText();
            const typeArgs = decl.type.typeArguments;
            const stateMachines = (
              decl.initializer as ObjectLiteralExpression
            ).properties.find(
              (prop) =>
                ts.isIdentifier(prop.name as PropertyName) &&
                prop.name?.getText() === "StateMachines"
            );
            if (
              typeArgs &&
              stateMachines &&
              ts.isPropertyAssignment(stateMachines)
            ) {
              const typeArgNames = typeArgs.map((arg) => arg.getText());
              const stateMachinesInitializer = stateMachines.initializer;
              if (
                stateMachinesInitializer &&
                ts.isObjectLiteralExpression(stateMachinesInitializer)
              ) {
                stateMachinesInitializer.properties.forEach((prop) => {
                  if (
                    ts.isPropertyAssignment(prop) &&
                    ts.isStringLiteral(prop.name) &&
                    ts.isObjectLiteralExpression(prop.initializer)
                  ) {
                    const stateMachineName = prop.name.text;
                    stateMachinesObject[stateMachineName] =
                      extractTestCasesKeys(prop.initializer);
                  }
                });
                mockConfigTypeArgs.push(...typeArgNames);
                break;
              }
            }
          }
        }
      }
    }
  });
  return {
    found: Object.keys(stateMachinesObject).length > 0,
    mockConfigTypeArgs,
    stateMachines: stateMachinesObject,
    decl: declName,
  };
};

// Function to parse the TypeScript file and return the result
export const parseTypeScriptFile = (
  inputFilePath: string
): {
  found: boolean;
  mockConfigTypeArgs?: string[];
  stateMachines?: StateMachines;
  decl: string;
} => {
  const sourceCode = sys.readFile(inputFilePath);
  must(sourceCode, "failed to find input");
  const sourceFile = createSourceFile(
    inputFilePath,
    sourceCode,
    ScriptTarget.Latest,
    true,
    ScriptKind.TS
  );
  return findExportedMockConfigFile(sourceFile);
};

export const emitTestFile = ({
  mockConfig,
  mockConfigSrcFile,
  mockConfigTypeArgs,
  aslSourcePath,
  testCases,
}: {
  mockConfig: string;
  mockConfigSrcFile: string;
  mockConfigTypeArgs: string[];
  aslSourcePath: string;
  testCases: string[];
}): string => {
  const optionalTypeArgs =
    mockConfigTypeArgs.length > 0 ? `<${mockConfigTypeArgs.join(",")}>` : "";
  const aslFileName = aslSourcePath.split("/").slice(-1)[0] as string;
  const aslFileStem = aslFileName.split(".asl.json")[0] as string;
  return `import path from "path";
import { AslTestRunner } from "../runner";
import type {
  CustomErrors,
  StateMachineNames,
  StateNames,
  TestCases,
} from "${mockConfigSrcFile}";
import { ${mockConfig}, StartMessages } from "${mockConfigSrcFile}";
import { must } from "asl-puml";

jest.setTimeout(180 * 1000);
describe("tests for ${aslFileName}", () => {
  const outdir = path.join(__dirname, ".asl-puml");

  let _aslRunner: AslTestRunner${optionalTypeArgs} | null = null;

  beforeAll(async () => {
    _aslRunner = await AslTestRunner.createRunner${optionalTypeArgs}(${mockConfig}, {
      "${aslFileStem}": path.join(
        __dirname,
        "${aslSourcePath}"
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

    ${testCases
      .map((tc) => {
        return `
    it("scenario ${tc}", async () => {
      expect.hasAssertions();
      invariant(_aslRunner);
      await _aslRunner.execute(
        {
          name: "${aslFileStem}",
          startMessage: StartMessages['${tc}'],
          scenario: "${tc}",
        },
        afterCompletion
      );
    });
        `;
      })
      .join("\n")}
  });
});
  `;
};
