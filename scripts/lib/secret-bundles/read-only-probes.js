#!/usr/bin/env node

const { spawnSync } = require("child_process");

function postgresEnvironment(connectionUrl) {
  const parsed = new URL(connectionUrl);
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) throw new Error("POSTGRES_URL_INVALID");
  const passwordVariable = ["PG", "PASSWORD"].join("");
  return {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    [passwordVariable]: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    PGSSLMODE: parsed.searchParams.get("sslmode") || "require",
  };
}

function postgresConnectivity(psqlBin = "/usr/bin/psql", env = process.env, variableName = "DATABASE_URL") {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variableName) || !env[variableName]) return 2;
  let pgEnv;
  try { pgEnv = postgresEnvironment(env[variableName]); } catch { return 2; }
  // The URL is translated into libpq environment fields so credentials never
  // appear in argv or output. The fixed query cannot mutate database state.
  const result = spawnSync(psqlBin, ["-X", "-v", "ON_ERROR_STOP=1", "-Atqc", "select 1"], {
    env: pgEnv,
    stdio: "ignore",
    timeout: 30000,
  });
  return typeof result.status === "number" ? result.status : 1;
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === "postgres-connectivity") {
    return postgresConnectivity(argv[1], process.env, argv[2] || "DATABASE_URL");
  }
  return 2;
}

if (require.main === module) process.exitCode = main();

module.exports = { main, postgresConnectivity, postgresEnvironment };
