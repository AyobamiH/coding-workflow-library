"use strict";

// Compatibility facade: implementation lives in focused domain parts.
module.exports = {
  ...require("./observability-routes-part-1"),
  ...require("./observability-routes-part-2"),
  ...require("./observability-routes-part-3"),
};
