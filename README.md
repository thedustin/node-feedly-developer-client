# Node Feedly Developer Client

Simple client to build personal applications for your Feedly account.

This package makes use of the developer access token instead of
the user OAuth mechanism, use for this purpose a package like
the [feedly](https://www.npmjs.com/package/feedly) package.

For more information about the limitations and options of
the developer access token and how to generate the token
see https://developer.feedly.com/v3/developer/.

## Installation

```bash
npm install --save node-feedly-developer-client
```

## Usage

First create an instance

```js
const FeedlyClient = require("node-feedly-developer-client");

const feedly = new FeedlyClient({
    accessToken: "YourSecr3tAccessT0ken",
});
```

You can also use your refresh token if you have an enterprise
account, this way the feedly client will handle the access token stuff.

```js
const FeedlyClient = require("node-feedly-developer-client");

const feedly = new FeedlyClient({
    refreshToken: "YourSecr3tEnterpriseRefreshT0ken",
});
```

Now you can use the `feedly` instance to fetch Feedly endpoints.
Every endpoint returns a promise with the parsed json and
the fetch response as an object.

Tip: Use [Object destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment#Object_destructuring) for easier access.

```js
feedly.profile().then(({response, body}) => {
    console.info("Fetched my profile from Feedly API");
    console.dir(body);
});
```
