"use strict";

// Compatibility facade: implementation lives in focused domain parts.
module.exports = {
  ...require("./supabase-control-part-1"),
  ...require("./supabase-control-part-2"),
  ...require("./supabase-control-part-3"),
};
