const RestClientDelta = require('./rest');
// const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class DeltaRequests {
  supportedFileTypes = ['img', 'video'];
  delta_promises: any;
  restClient: any;
  delta_launch_id: number;
  delta_test_run_id: number;
  test_suite_history_id: number;
  test_suite_id: number;

  constructor(host: string) {
    this.delta_promises = {};
    this.restClient = new RestClientDelta(host);
  }

  getLaunchById(id: number) {
    const url = ['api/v1/launch', id].join('/');
    return this.restClient.retrieve(url);
  }

  createLaunch(data: object) {
    const url = ['api/v1/launch'];
    return this.restClient.create(url, data);
  }

  createTestRun(data: object) {
    const url = ['api/v1/test_run'];
    return this.restClient.create(url, data);
  }

  createTestSuiteHistory(data: object) {
    const url = ['api/v1/test_suite_history'];
    let response = this.restClient.create(url, data);
    this.test_suite_id = response.test_suite_id;
    this.test_suite_history_id = response.test_suite_history_id;

    return response;
  }

  createTestHistory(data: object) {
    const url = ['api/v1/test_history'];
    return this.restClient.create(url, data);
  }

  async createSkippedTestHistory(data: any, suite: string, options?: any) {
    let url = ['api/v1/test_history'];
    if (this.checkFileExistsSync(`./.delta_service/${suite.replace(/ /g, '-')}.json`)) {
      const test_suite = JSON.parse(fs.readFileSync(`./.delta_service/${suite.replace(/ /g, '-')}.json`));
      data['test_suite_id'] = test_suite.test_suite_id;
      data['test_suite_history_id'] = test_suite.test_suite_history_id;
      data['status'] = 'Skipped';
      return await this.restClient.create(url, data);
    } else {
      let test_run_suite = {
        name: suite,
        test_type: options.testType,
        start_datetime: new Date(),
        test_run_id: data.test_run_id,
        project: options.project
      };

      let response = await this.createTestSuiteHistory(test_run_suite);
      fs.writeFileSync(path.resolve(`./.delta_service/${suite.replace(/ /g, '-')}.json`), JSON.stringify(response));

      data['test_suite_id'] = response.test_suite_id;
      data['test_suite_history_id'] = response.test_suite_history_id;
      data['status'] = 'Skipped';
      return await this.restClient.create(url, data);
    }
  }

  updateTestHistory(data: object) {
    const url = ['api/v1/test_history'];
    return this.restClient.update(url, data);
  }

  updateSuiteHistory(data: object) {
    const url = ['api/v1/test_suite_history'];
    return this.restClient.update(url, data);
  }

  updateTestRun(data: object) {
    const url = ['api/v1/test_run'];
    return this.restClient.update(url, data);
  }

  finishLaunch(data: object) {
    const url = ['api/v1/finish_launch'];
    return this.restClient.update(url, data);
  }

  sendDataTest(test_id: number, data: any) {
    const url = ['api/v1/test_data/' + test_id];
    return this.restClient.update(url, data);
  }

  sendDataTestRun(test_run_id: number, data: any) {
    const url = ['api/v1/test_run_data/' + test_run_id];
    return this.restClient.update(url, data);
  }

  checkFileExistsSync(filepath: string) {
    let flag = true;
    try {
      fs.accessSync(filepath, fs.constants.F_OK);
    } catch (e) {
      flag = false;
    }
    return flag;
  }
}

module.exports = DeltaRequests;
