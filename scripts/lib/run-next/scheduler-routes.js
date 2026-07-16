"use strict";

// Compatibility facade: implementation lives in focused domain parts.
module.exports = {
  ...require("./scheduler-routes-part-1"),
  ...require("./scheduler-routes-part-2"),
  ...require("./scheduler-routes-part-3"),
};
