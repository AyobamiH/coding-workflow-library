"use strict";

// Compatibility facade: implementation lives in focused domain parts.
module.exports = {
  ...require("./release-routes-part-1"),
  ...require("./release-routes-part-2"),
  ...require("./generic-npm-prerelease-route"),
};
