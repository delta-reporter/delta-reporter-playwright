# Delta Reporter Playwright Service

> A Playwright reporter plugin to create [Delta reports](https://github.com/delta-reporter/delta-reporter)


![Screenshot of Delta reporter](https://raw.githubusercontent.com/delta-reporter/delta-reporter-wdio/master/src/docs/delta-reporter.png)


## Installation

The easiest way is to keep `@delta-reporter/delta-playwright-plugin` as a devDependency in your `package.json`.

```json
{
  "devDependencies": {
    "@delta-reporter/delta-playwright-plugin": "^1.0.0",
  }
}
```

You can simple do it by:

```bash
npm i @delta-reporter/delta-playwright-plugin
```

## Configuration

The use of this plugin is as simple as defining the required config and then setting the reported as this plugin.

```ts
const DeltaConfig = {
  'host': 'delta_host',
  'project': 'Project Name',
  'testType': 'Test Type',
  'enabled': true
};

const config: PlaywrightTestConfig = {
  // ...
  reporter: process.env.CI ? [['@delta-reporter/delta-playwright-plugin', DeltaConfig]] : "list",
  // ...
}
```

Please notice that the example above would use this reporter just on CI mode, and use `list` reporter when running locally

## Usage

For each test run, the plugin is listening for a `DELTA_LAUNCH_ID`. There are two main cases:

- Local run: You can just run your tests as usual and `DELTA_LAUNCH_ID` will be generated automatically for you, so your test results appear in Delta Reporter in real time.

- CI run: You will have to define `DELTA_LAUNCH_ID` as a environment variable. You can get it by calling the `/api/v1/launch` endpoint, then running your tests with `DELTA_LAUNCH_ID=${DELTA_LAUNCH_ID}` pre-pending. The initialization is done once, so when you are running multiple test types in the same build (say, UI tests, API tests, Unit tests), those tests are gathered under one "Launch" on Delta Reporter.

Below is an example for a Jenkins job:

```groovy
// ...
  parameters {
      string defaultValue: '', description: 'Launch ID sent by a pipeline, leave it blank', name: 'DELTA_LAUNCH_ID', trim: false
  }

// ...

  stage('Run Playwright tests') {
    environment {
      DELTA_LAUNCH_ID = ""
    }
    steps {
      container('jenkins-node-worker') {
        script {
          try {
            DELTA_LAUNCH_ID=sh(script: "curl -s --header \"Content-Type: application/json\" --request POST --data '{\"name\": \"${JOB_NAME} | ${BUILD_NUMBER} | Wdio Tests\", \"project\": \"Your project\"}' https://delta-core-url/api/v1/launch | python -c 'import sys, json; print(json.load(sys.stdin)[\"id\"])';", returnStdout: true)
          } catch (Exception e) {
              echo 'Couldn\'t start launch on Delta Reporter: ' + e
          }

          sh "DELTA_LAUNCH_ID=${DELTA_LAUNCH_ID} npx playwright test"
        }
      }
    }
  }
```

Below is an example of code for a Github Action:

```yaml
// ...
      - name: Create Delta Launch
        id: delta_launch_creation
        env:
          PR_ID: ${{ github.event.pull_request.number }}
        run: |
          CURRENT_TIMESTAMP=$(date -R)
          DELTA_LAUNCH_ID=$(curl -s --header "Content-Type: application/json" --request POST --data '{"name": "PR: '"${PR_ID}"' '"${CURRENT_TIMESTAMP}"'", "project": "<project>" }' <delta_url>/api/v1/launch | jq '.id';)
          echo "DELTA_LAUNCH_ID: $DELTA_LAUNCH_ID"
          echo ::set-output name=delta_launch_id::${DELTA_LAUNCH_ID}
      - name: Notify test results
        uses: actions/github-script@v4
        env:
          DELTA_LAUNCH_ID: ${{ steps.delta_launch_creation.outputs.delta_launch_id }}
        with:
          script: |
            github.issues.createComment({
                  issue_number: context.issue.number,
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  body: `Regression Tests Launch ${process.env.DELTA_LAUNCH_ID} has started, check tests results in real time [here](<delta_url>/testruns/${process.env.DELTA_LAUNCH_ID})`
                })
      - name: Run Unit Tests
        env:
          DELTA_LAUNCH_ID: ${{ steps.delta_launch_creation.outputs.delta_launch_id }}
        run: |
          npx playwright test -c unit_tests
      - name: Run End to End Tests
        env:
          DELTA_LAUNCH_ID: ${{ steps.delta_launch_creation.outputs.delta_launch_id }}
        run: |
          npx playwright test -c end_to_end
```
