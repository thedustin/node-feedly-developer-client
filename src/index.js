const fetch = require('node-fetch');
const querystring = require('querystring');

/**
 * @typedef FeedlyInit
 * @type {object}
 *
 * @param {string} [baseUrl="https://cloud.feedly.com"] - The API base url
 * @param {?string} accessToken - The access token to use, this prevent a refresh call on first request
 * @param {?string} refreshToken - The refresh token to use for generating new access tokens
 * @param {boolean} [refreshTokenInstant=false] - Generate a new refresh token instant instead of later on the first request
 */

/**
 * @typedef FeedlyResponse
 * @type {object}
 *
 * @param {Response} response - The original fetch response
 * @param {*} body - The JSON body as javascript value (properly an object, for the structure see the api documentation)
 */

/**
 * @typedef FeedlyStreamOptions
 * @type {object}
 *
 * @param {?number} [count=20] - The amount of entries to fetch (max: 1.000)
 * @param {?("newest" | "oldest")} [ranked="newest"] - The order to fetch
 * @param {?boolean} [unreadOnly=true] - Fetch only unread entries
 * @param {?number} [newerThan=null] - Fetch entries newer than this timestamp
 * @param {?string} [continuation=null] - The continuation identifier to fetch multiple pages
 */

/**
 * Symbol to hide internal stuff, this way only this file is able to access properties directly
 * @type {symbol}
 */
const INTERNALS = Symbol('FeedlyInternals');

class Feedly {

    /**
     * @param {FeedlyInit} options
     */
    constructor(options) {
        this[INTERNALS] = {
            /** @type {FeedlyInit} */
            options: Object.assign({
                baseUrl: "https://cloud.feedly.com",
                accessToken: null,
                refreshToken: null,
                refreshTokenInstant: false,
            }, options),

            /** @var {?Response} */
            lastResponse: null,
        };

        // Trim trailing slashes - I like to use paths with leading slashes
        if (this[INTERNALS].options.baseUrl.substring(-1) === "/") {
            this[INTERNALS].options.baseUrl = this[INTERNALS].options.baseUrl.substring(0, -1);
        }

        if (!this[INTERNALS].options.refreshToken) {
            throw new TypeError("`refreshToken` is required!");
        }

        if (this[INTERNALS].options.refreshTokenInstant) {
            this.refreshAuthToken();
        }
    }

    /**
     *
     * @returns {string}
     */
    get baseUrl() {
        return this[INTERNALS].options.baseUrl;
    }

    /**
     *
     * @returns {?string}
     */
    get accessToken() {
        return this[INTERNALS].options.accessToken;
    }

    /**
     *
     * @returns {?string}
     */
    get refreshToken() {
        return this[INTERNALS].options.refreshToken;
    }

    /**
     *
     * @returns {?Response}
     */
    get lastResponse() {
        return this[INTERNALS].lastResponse;
    }

    /**
     *
     * @param {String} url - The path to call
     * @param {?RequestInit} options
     * @returns {Promise<FeedlyResponse|never>}
     */
    async request(url, options = {}) {
        if (!this.accessToken && url !== "/v3/auth/token") {
            await this.refreshAuthToken();
        }

        return fetch(this.baseUrl + url, Object.assign({
            headers: {
                Authorization: "OAuth " + this.accessToken,
            }
        }, options)).then((response) => {
            this[INTERNALS].lastResponse = response;

            return response;
        }).then(
            Feedly.returnResponse
        ).catch(
            Feedly.catchError(`Failed to make call to ${url}`)
        );
    }

    /**
     * Simple helper function to return a response in "our" format
     *
     * @param {Response} response
     * @returns {Promise<FeedlyResponse>}
     * @private
     */
    static async returnResponse(response) {
        return response.json().then((json) => {
            return {
                response,
                body: json
            };
        });
    }

    /**
     * Get the profile of the user
     *
     * @returns {Promise<FeedlyResponse|never>}
     * @see {@link https://developer.feedly.com/v3/profile/#get-the-profile-of-the-user} Get the profile of the user
     */
    async profile() {
        return this.request("/v3/profile");
    }

    /**
     * Get the list of personal collections
     *
     * @returns {Promise<FeedlyResponse|never>}
     * @see {@link https://developer.feedly.com/v3/collections/#get-the-list-of-personal-collections} Get the list of personal collections
     */
    async collections() {
        return this.request("/v3/collections");
    }

    /**
     * Get the user’s subscriptions
     *
     * @returns {Promise<FeedlyResponse|never>}
     * @see {@link https://developer.feedly.com/v3/subscriptions/#get-the-users-subscriptions} Get the user’s subscriptions
     */
    async subscriptions() {
        return this.request("/v3/subscriptions");
    }

    /**
     * Reads the content of a stream (means the new news)
     *
     * @param {string} streamId - the stream id to read content from
     * @param {FeedlyStreamOptions} options - Options for the stream contents request. See https://developer.feedly.com/v3/streams/#get-the-content-of-a-stream
     * @returns {Promise<{Response, Object}>}
     */
    async streams(streamId, options = {}) {
        return this.request(
            "/v3/streams/contents?" + querystring.stringify({
                ...options,
                streamId: streamId,
            })
        );
    }

    /**
     * Refresh the used access tokens
     *
     * @returns {Promise<{response: Response, body: Object}>}
     */
    async refreshAuthToken() {
        return this.request("/v3/auth/token", {
            method: "POST",
            // Force no auth header
            headers: {},
            body: JSON.stringify({
                refresh_token: this.refreshToken,
                client_id: "feedlydev",
                client_secret: "feedlydev",
                grant_type: "refresh_token"
            })
        }).then(({response, body}) => {
            Feedly.logAuthBody(body);

            this[INTERNALS].options.accessToken = body.access_token;
        }).catch(Feedly.catchError('Failed to refresh token'));
    }

    /**
     * Returns the rate limits for feedly (based on the last response)
     *
     * @returns {{count: number, reset: number}}
     * @throws {Error} - Thrown when there was no request to feedly yet (so we don‘t have a response to lookup)
     */
    get ratelimit() {
        const lastResponse = this.lastResponse;

        if (!lastResponse) {
            throw new Error("Cannot get rate limits: There was no response yet");
        }

        const headers = lastResponse.headers;

        return {
            count: parseInt(headers.get("X-Ratelimit-Count"), 10),
            reset: parseInt(headers.get("X-Ratelimit-Reset"), 10),
        }
    }

    /**
     * Logs the refresh token authentications body and removes sensitive data
     *
     * @param {Object} body
     *
     * @private
     */
    static logAuthBody(body) {
        const bodyCopy = {...body};
        bodyCopy.access_token = `String[${body.access_token.length}]`;

        console.info("Refresh of tokens was successful: %o", bodyCopy);
    }

    /**
     * Returns a function to catch an promise error
     *
     * @param {string} prefix - A prefix message to prepend to the error (e.g. for identification purpose)
     * @returns {Function}
     *
     * @private
     */
    static catchError(prefix) {
        return (error) => {
            console.error(`${prefix}: ${error}`);
        };
    }
}

module.exports = Feedly;
