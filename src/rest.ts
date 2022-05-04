const axios = require('axios').default;
const axiosRetry = require('axios-retry');

axiosRetry(axios, { retryDelay: () => 100, retries: 10, retryCondition: axiosRetry.isRetryableError });

class RestClient {
  baseURL: string;
  headers: any;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  buildPath(path: string) {
    return [this.baseURL, path].join('/');
  }

  static request(method: string, url: string, data: {}, options: any = {}) {
    return axios({
      method,
      url,
      headers: options.headers,
      data
    })
      .then((response: { data: any; }) => response.data)
      .catch((error: { message: any; response: { data: any; }; }) => {
        const errorMessage = error.message;
        const responseData = error.response && error.response.data;
        throw new Error(
          `${errorMessage}${
            responseData && typeof responseData === 'object' ? `: ${JSON.stringify(responseData)}` : ''
          }`
        );
      });
  }

  create(path: string, data: {}, options = { headers: this.headers }) {
    return RestClient.request('POST', this.buildPath(path), data, options);
  }

  retrieve(path: string, options = { headers: this.headers }) {
    return RestClient.request('GET', this.buildPath(path), {}, options);
  }

  update(path: string, data: {}, options = { headers: this.headers }) {
    return RestClient.request('PUT', this.buildPath(path), data, options);
  }

  delete(path: string, data: {}, options = { headers: this.headers }) {
    return RestClient.request('DELETE', this.buildPath(path), data, options);
  }
}

module.exports = RestClient;
