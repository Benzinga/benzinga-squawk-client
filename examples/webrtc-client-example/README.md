# Squawk WebRTC Client 

## Overview

This Squawk WebRTC Client demonstrates how to connect to squawk over WebRTC using signaling messages documented at https://docs.benzinga.io/benzinga/squawk-v3.html#using-rtp

- [npm](https://nodejs.org/en/)
- [yarn](https://classic.yarnpkg.com/en/docs/install#debian-stable)
- Squawk WebSocket address. Contact the Benzinga licensing team at  licensing@benzinga.com for more details.
- JWT token. For authentication, squawk uses JWT. We recommend using asymmetric JWT. For that, you need to share your the corresponding public key with Benzinga. Please get in touch at licensing@benzinga.com for sharing the public key or more information on authentication. 

## How to Build and Run

Once you have shared the public key for JWT with Benzinga and got the squawk address to test for, replace corresponding values in .env file as `SQUAWK_ADDR` and `JWT_TOKEN`. 

Use the yarn package manager to run, test, and build the app.

#### `yarn start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

#### `yarn test`

Launches the test runner in the interactive watch mode.<br />

#### `yarn build`

Builds the app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
