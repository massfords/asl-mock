# Sample Application

This folder provides a sample step function and MockConfigFile. 

| File                      | Description                                   |
|---------------------------|-----------------------------------------------|
| .asl-puml                 | PlantUML diagrams of test runs                |
| \_\_snapshots__           | Standard jest style snapshots for task inputs |
| crm-comment.asl.json      | Step Function in ASL JSON                     |
| crm-comment.asl.test.json | Unit test generated from the MockConfig       |
| crm-comment.mock.ts       | MockConfig type for the tests                 |

# Step Function

- sourced from the AWS step function examples project
- includes a parallel activity 
- includes retry logic
- includes custom faults

# MockConfigFile

- ported from the JSON file
- state names and other types added manually
