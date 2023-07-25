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
import invariant from "tiny-invariant";

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
} => {
  const stateMachinesObject: StateMachines = {};
  const mockConfigTypeArgs: string[] = [];
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
  };
};

// Function to parse the TypeScript file and return the result
export const parseTypeScriptFile = (
  inputFilePath: string
): { found: boolean; typeArgs?: string[]; stateMachines?: StateMachines } => {
  const sourceCode = sys.readFile(inputFilePath);
  invariant(sourceCode, "failed to find input");
  const sourceFile = createSourceFile(
    inputFilePath,
    sourceCode,
    ScriptTarget.Latest,
    true,
    ScriptKind.TS
  );
  return findExportedMockConfigFile(sourceFile);
};
