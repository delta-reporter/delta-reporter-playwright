
import {
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
const rimraf = require('rimraf');
const fs = require('fs');
const DeltaRequests = require('./requests');
const util = require('util');
const debuglog = util.debuglog('delta');
import path from 'path';

interface DeltaReporterConfig {
  project: string;
  host: string;
  testType: string;
  enabled: boolean;
}

export class DeltaReporter implements Reporter {
  config: DeltaReporterConfig;
  launchId: string;
  promises: Promise<any>[];
  customLaunchStatus: string;
  requests: any;

  constructor(config: DeltaReporterConfig) {
    this.config = config;
    this.requests = new DeltaRequests(config.host);
    this.promises = [];
    this.customLaunchStatus = '';
  }

  onBegin(config: any, suite: any) {
    if (!this.config.enabled) return;

    rimraf.sync('./.delta_service');
    fs.mkdirSync('./.delta_service');
    fs.mkdirSync('./.delta_service/suites');

    let launchId: string = process.env.DELTA_LAUNCH_ID;
    let promise: any;

    let test_run_payload = (launchId: string) => {
      return {
        test_type: this.config.testType,
        environment: suite.title,
        launch_id: launchId,
        start_datetime: new Date()
      }
    };

    if (!launchId || isNaN(Number(launchId))) {
      console.info('No Launch detected, creating a new one...');
      let date = new Date();
      let hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
      let minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
      let seconds = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();
      let name = this.config.testType + ' | ' + date.toDateString() + ' - ' + hours + ':' + minutes + ':' + seconds;

      let launch = {
        name: name,
        project: this.config.project
      };
      promise = this.requests.createLaunch(launch);
      promise.then((response: any) => {
        fs.writeFileSync(path.resolve('./.delta_service/launch.json'), JSON.stringify(response));
        launchId = response.id;
        promise = this.requests.createTestRun(test_run_payload(launchId));
        this.promises.push(promise)
      })
    } else {
      promise = this.requests.createTestRun(test_run_payload(launchId));
      this.promises.push(promise)
    }
  }

  onTestBegin(test: TestCase): void {
    if (!this.config.enabled) return;

    let create_test = (test_suite_id: number, test_run: number, test_suite_history_id: number) => {
      let test_history = {
        name: test.title,
        start_datetime: new Date(),
        test_suite_id: test_suite_id,
        test_run_id: test_run,
        test_suite_history_id: test_suite_history_id
      };

      let test_history_promise = this.requests.createTestHistory(test_history);
      test_history_promise.then((response: any) => {
        let test_name = `${test.parent.project().name.replace(/ /g, "_")}-${test.parent.title.replace(/ /g, "_")}-${test.title.replace(/ /g, "_")}`
        fs.writeFileSync(path.resolve('./.delta_service/<test>.json'.replace("<test>", test_name)), JSON.stringify(response));
      })
    }

    let create_suite = (test_run: number) => {
      let suite_file = test.parent.project().name.replace(/ /g, "_") + "-" + test.parent.title.replace(/ /g, "_")

      try {
        let file = JSON.parse(fs.readFileSync('./.delta_service/suites/<suite>.json'.replace("<suite>", suite_file)));
        create_test(file.test_suite_id, test_run, file.test_suite_history_id);
      } catch {
        let test_run_suite = {
          name: `${test.parent.project().name} - ${test.parent.title}`,
          test_type: this.config.testType,
          start_datetime: new Date(),
          test_run_id: test_run,
          project: this.config.project
        };

        let test_suite_promise = this.requests.createTestSuiteHistory(test_run_suite);

        test_suite_promise.then((response: any) => {
          fs.writeFileSync(path.resolve('./.delta_service/suites/<suite>.json'.replace("<suite>", suite_file)), JSON.stringify(response));
          create_test(response.test_suite_id, test_run, response.test_suite_history_id);
        })
      }
    }

    try {
      let file = JSON.parse(fs.readFileSync('./.delta_service/testRun.json'));
      create_suite(file.id)
    } catch {
      let test_run_promise = this.promises.pop()

      test_run_promise.then((response) => {
        fs.writeFileSync(path.resolve('./.delta_service/testRun.json'), JSON.stringify(response));
        create_suite(response.id)
      })
    }
  }

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    if (!this.config.enabled) return;
    let update_test = (test_history_id: number, status: string, error_trace: string, error_message: string) => {

      switch (status) {
        case "timedOut": {
          status = "Failed"
          break;
        }
        default: {
          status = status.charAt(0).toUpperCase() + status.slice(1)
          break;
        }
      }

      if(status = "Passed"){
        console.log(`\n${test.parent.project().name} - ${test.parent.title}
                    - ${test.title}: ${status}`)
      } else {
        console.log(`\n${test.parent.project().name} - ${test.parent.title}
                    - ${test.title}: ${status}

                  ${error_message ? error_message : ""}
                  ${error_trace ? error_trace : ""}`)
      }

      let test_history = {
        test_history_id: test_history_id,
        end_datetime: new Date(),
        test_status: status,
        trace: error_trace ? error_trace : null,
        file: test.location.file,
        message: error_message ? error_message : null,
        error_type: result.stderr.length > 0 ? String(result.stderr[0]).substring(0, 249) : null,
        retries: test.retries
      };
      this.requests.updateTestHistory(test_history).then((reponse: any) => {
        debuglog(reponse);
      })
    }
    try {
      let test_name = `${test.parent.project().name.replace(/ /g, "_")}-${test.parent.title.replace(/ /g, "_")}-${test.title.replace(/ /g, "_")}`
      let file = JSON.parse(fs.readFileSync('./.delta_service/<test>.json'.replace("<test>", test_name)));

      let trace = result.error ? result.error.stack : null;
      let error_message = result.error ? result.error.message : null

      update_test(file.test_history_id, result.status, trace, error_message)
    } catch (exception) {
      console.warn("Unexpected error:")
      console.error(exception)
    }
  }

  async onEnd(result: any): Promise<void> {
    if (!this.config.enabled) return;

    fs.readdir("./.delta_service/suites", (err: any, files: []) => {
      if (err)
        console.warn(err);
      else {
        files.forEach(file => {
          if (path.extname(file) == ".json") {
            let suite = JSON.parse(fs.readFileSync('./.delta_service/suites/<file>'.replace("<file>", file)));

            let test_suite_history = {
              test_suite_history_id: suite.test_suite_history_id,
              end_datetime: new Date()
            };
            this.requests.updateSuiteHistory(test_suite_history).then((response: any) => { debuglog(response) })
          }
        })
      }
    })

    let status;

    switch (result.status) {
      case "skipped":
      case "timedOut": {
        status = "Failed"
        break;
      }
      default: {
        status = result.status.charAt(0).toUpperCase() + result.status.slice(1)
        break;
      }
    }

    const testRun = JSON.parse(fs.readFileSync('./.delta_service/testRun.json'));
    let launch;
    let response: any;
    try {
      launch = JSON.parse(fs.readFileSync('./.delta_service/launch.json'));
    } catch {
      launch = null;
    }

    let test_run = {
      test_run_id: testRun.id,
      end_datetime: new Date(),
      test_run_status: status
    };
    response = await this.requests.updateTestRun(test_run);
    debuglog(response);

    if (launch) {
      response = await this.requests.finishLaunch({ launch_id: launch.id });
      debuglog(response);
    }
  }
}
