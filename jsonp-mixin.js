﻿/**
 * Creates a JSONP *behavior* that facilitate making JSONP requests.
 * This *behavior* can be used to extend `<vo-jsonp>`.
 *
 * @param {superClass} superClass to add the mixin to.
 * @return {superClass} superClass with the added behavior.
 *
 * @polymerBehavior
 */
JsonpMixin = (superClass) => class extends superClass {
  /**
   * Fired when a response or an error is received.
   *
   * @event complete
   * @param {Request} event.detail An object that represents the request that was made.
   */

  /**
   * Fired when an error is received.
   *
   * @event error
   * @param {Event} event.detail The `error event` returned when the request resulted in an error.
   */

  /**
   * Fired when a request is loaded.
   *
   * @event load
   * @param {Event} event.detail The `load event` generated when a request was loaded.
   */

  /**
   * Fired when a response is received.
   *
   * @event response
   * @param {JSON} event.detail The data returned from making the request.
   */

  /**
   * Fired when a request is sent.
   *
   * @event sent
   * @param {Request} event.detail An object that represents the request that is being made.
   */

  /**
   * Information used to make a request.
   *
   * @typedef {Object} Request
   *
   * @property {HTMLElement} script The script used to make the request.
   * @property {object} options The options used to make the request.  See `_requestOptions`.
   * @property {boolean} loading Whether the request is loading or not.
   */

  /**
   * This is a factory/constructor method.  To use this method call `new vo.Jsonp(options)`.
   * Any properties passed in the options object will be added to the element as attributes.
   *
   * @param {Object} options Attributes to be added to the element upon construction.
   */
  constructor(options) {
    super();
    if (options && typeof options === 'object') {
      let element = this;

      Object.keys(options).forEach(function(key) {
        element.setAttribute(key, options[key]);
      });
    }
  }

  static get properties() {
    return {
      /**
       * An Array of all in-flight requests originating from this `<vo-jsonp>`.
       *
       * @type {Array<Request>}
       * @default []
       */
      activeRequests: {
        type: Array,
        notify: true,
        readOnly: true,
        value: [],
      },

      /**
       * If `true`, automatically performs requests when any non-readOnly properties change.
       */
      auto: {
        type: Boolean,
        value: false,
      },

      /**
       * If `true`, force requests to be cached by the browser.
       *
       * Note:
       * - This will only work if `callback-value` is set to a static value and
       * non-readOnly attributes do not change between requests.
       * - This works by removing the `_={guid}` query string parameter from the request.
       */
      cache: {
        type: Boolean,
        value: false,
      },

      /**
       * Overrides the callback parameter key name in requests or removes the parameter completely.
       * This is the `callback-key` in the "{callback-key}={callback-value}" pair.
       *
       * Note:
       * - Setting `callback-key` to an empty string will remove the "callback={callback-value}"
       * query string parameter from requests. Setting it to any valid string will force
       * it to be used instead of "callback", e.g., "{callback-key}={callback-value}".
       */
      callbackKey: {
        type: String,
        value: 'callback',
      },

      /**
       * Specifies the JSONP wrapper function name and is the `callback-value` in the "{callback-key}={callback-value}" pair.
       *
       * Note:
       * - The server will use this value to properly wrap JSONP request responses.
       * Change this to a static value when browser caching is desired (see `cache`).
       *
       * @default vo_jsonp_callback_{guid}
       */
      callbackValue: {
        type: String,
        value: function() {
          return 'vo_jsonp_callback_' + this._newGuid(true);
        },
      },

      /**
       * The length of time in milliseconds to debounce multiple requests.
       */
      debounceDuration: {
        type: Number,
        value: 0,
      },

      /**
       * Will be set to `true` if an attempt was made to abort the most recent request.
       */
      lastAborted: {
        type: Boolean,
        notify: true,
        readOnly: true,
        reflectToAttribute: true,
        value: false,
      },

      /**
       * Will be set to the most recent error that resulted from a request
       * that originated from this `<vo-jsonp>`.  This value will be
       * `undefined` if no request have completed with an error.
       *
       * @type {Event}
       * @default undefined
       */
      lastError: {
        type: Object,
        notify: true,
        readOnly: true,
      },

      /**
       * Will be set to the most recent load event that resulted from a request
       * that originated from this `<vo-jsonp>`.  This value will be
       * `undefined` if no requests have been sent.
       *
       * @type {Event}
       * @default undefined
       */
      lastLoad: {
        type: Object,
        notify: true,
        readOnly: true,
      },

      /**
       * Will be set to the most recent request made by this `<vo-jsonp>`.
       * This value will be `undefined` if no requests have been sent.
       *
       * @type {Request}
       * @default undefined
       */
      lastRequest: {
        type: Object,
        notify: true,
        readOnly: true,
      },

      /**
       * Will be set to the most recent response that resulted from a request
       * that originated from this `<vo-jsonp>`.  This value will be
       * `undefined` if no requests have completed with a success.
       *
       * @type {JSON}
       * @default undefined
       */
      lastResponse: {
        type: Object,
        notify: true,
        readOnly: true,
      },

      /**
       * Will be set to true if there is at least one in-flight request
       * associated with this `<vo-jsonp>`.
       */
      loading: {
        type: Boolean,
        notify: true,
        readOnly: true,
        reflectToAttribute: true,
        value: false,
      },

      /**
       * An object that contains query parameters to be appended to the specified `url`
       * when generating a request.  Specify `params` as a double quoted JSON string.
       *
       * @type {JSON}
       */
      params: {
        type: Object,
        value: function() {
          return {};
        },
      },

      /**
       * Toggle whether requests are synchronous or asynchronous.
       */
      sync: {
        type: Boolean,
        value: false,
      },

      /**
       * The URL target of the request.
       */
      url: {
        type: String,
        value: '',
      },
    };
  }

  // All non-readOnly properties
  static get observers() {
    return ['_requestOptionsChanged(auto, cache, callbackKey, callbackValue, debounceDuration, params, sync, url)'];
  }

  /**
   * @return {String} _queryString The query string added to the URL in a request.
   */
  get _queryString() {
    let params = this.params || {};

    if (this.callbackKey === undefined || this.callbackKey) {
      params[this.callbackKey] = this.callbackValue;
    }

    if (!this.cache) {
      params._ = this._newGuid(true);
    }

    return Object.keys(params).reduce(function(arr, key) {
      return arr.push(key + '=' + encodeURIComponent(params[key])) && arr;
    }, []).join('&');
  }

  /**
   * @return {String} _requestUrl The url and query string used in a request.
   */
  get _requestUrl() {
    let queryString = this._queryString;

    return queryString ? this.url + '?' + queryString : this.url;
  }

  /**
   * @return {Object} _requestOptions The request options used to make the request.
   */
  get _requestOptions() {
    return {
      cache: this.cache,
      callbackKey: this.callbackKey,
      callbackValue: this.callbackValue,
      sync: this.sync,
      url: this._requestUrl,
    };
  }

  /**
   * Handles debouncing multiple requests.
   */
  _requestOptionsChanged() {
    this._debounceJob = Polymer.Debouncer.debounce(this._debounceJob,
        Polymer.Async.timeOut.after(this.debounceDuration), () => {
          if (this.auto) {
            try {
              this.generateRequest();
            } catch (error) {
              // ignore if we get issues
            }
          }
        });
  }

  /**
   * Performs a request to the specified URL.
   *
   * @return {Request} request Information about the request.
   */
  generateRequest() {
    if (this.cache && (/^vo_jsonp_callback_[0-9a-f]{32}$/.test(
            this.callbackValue) || !this.callbackValue)) {
      throw new Error(
          '`callback-value` must be declared or `callbackValue` set when `cache` is true.');
    }

    if (!this.url) {
      throw new Error(
          '`url` must be declared or set in order to perform a request.');
    }

    let request = {};
    request.loading = true;

    this._setLoading(true);
    this._setLastAborted(false);
    this._setLastRequest(request);
    this.activeRequests.push(request);

    request.options = this._requestOptions;

    request.script = document.createElement('script');
    request.script.src = this._requestUrl;
    request.script.async = this.sync ? false : true;
    request.script.onload = this._handleLoad.bind(this, request);
    request.script.onerror = this._handleError.bind(this, request);
    window[this.callbackValue] = this._handleResponse.bind(this, request);

    document.querySelector('head').appendChild(request.script);

    this.dispatchEvent(new CustomEvent('sent'), request);

    return request;
  }

  /**
   * Aborts an in-flight request.  If no request is passed the most recent request (last-request) will be aborted.
   *
   * Note:
   * - No complete event will be fired if a request is aborted.
   *
   * @param {Request} request The request to abort.
   */
  abortRequest(request) {
    if (!request && this.activeRequests.length) {
      request = this.activeRequests[this.activeRequests.length - 1];
    }

    if (request && this.activeRequests.indexOf(request)
        === this.activeRequests.length - 1) {
      this._setLastAborted(true);
    }

    this._cleanupRequest(request);
  }

  /**
   * Discards a request and cleans up internal state appropriately.
   *
   * @param {Request} request The request to discard.
   */
  _discardRequest(request) {
    this._cleanupRequest(request);
    this.dispatchEvent(new CustomEvent('complete'), request);
  }

  /**
   * A method to cleanup a request.
   *
   * @param {Request} request The request to cleanup.
   */
  _cleanupRequest(request) {
    let requestIndex = this.activeRequests.indexOf(request);

    if (requestIndex >= 0) {
      this.activeRequests[requestIndex].loading = false;

      let loadingRequests = this.activeRequests.filter(
          function(activeRequest) {
            return activeRequest.loading;
          });

      if (!loadingRequests.length) {
        this._setLoading(false);
      }

      this.activeRequests.splice(requestIndex, 1);
      delete window[this.callbackValue];
      request.script.parentNode.removeChild(request.script);
      request = null;
    }
  }

  /**
   * Handles the response from a request.
   *
   * @param {Script} request The request that this response came from.
   * @param {JSON} data The data returned from the request.
   */
  _handleResponse(request, data) {
    this._setLastResponse(data);
    this._setLastError(undefined);

    this.dispatchEvent(new CustomEvent('response'), data);

    this._discardRequest(request);
  }

  /**
   * Handles errors from a request.
   *
   * @param {Script} request The request that this error came from.
   * @param {Event} event The error event that was thrown.
   */
  _handleError(request, event) {
    this._setLastResponse(undefined);
    this._setLastError(event);

    this.dispatchEvent(new CustomEvent('error'), event);

    this._discardRequest(request);
  }

  /**
   * Handles the load of a request.
   *
   * @param {Script} request The request that this load event came from.
   * @param {Event} event The load event created by making this request.
   */
  _handleLoad(request, event) {
    this._setLastLoad(event);

    this.dispatchEvent(new CustomEvent('load', event));
  }

  /**
   * Generates a new guid.
   *
   * @param {boolean} noDashes Whether to include dashes or not.
   * @return {string} guid A new guid.
   */
  _newGuid(noDashes) {
    let guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
        function(char) {
          let randomNum = Math.random() * 16 | 0;
          let value = char === 'x' ? randomNum : (randomNum & 0x3 | 0x8);

          return value.toString(16);
        });

    return noDashes ? guid.replace(/-/g, '') : guid;
  }
};
