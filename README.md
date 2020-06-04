# Mojaloop Reporting Service
- Map SQL queries to HTTP routes in `config/reports.json`.
- The format is
    ```json
    {
        "/route/to/serve/report/on": "SELECT some, data FROM some_table WHERE some_parameter = $P{url_query_string_param}",
        "/other/route": "SELECT more, stuff FROM another_table WHERE whatever = $P{some_different_param}",
        "/route/with/optional/param": "SELECT even, more, stuff FROM another_table WHERE whatever = $O{optional_param} OR $O{optional_param} IS NULL"
    }
    ```
- Make requests as follows:
    ```
    curl localhost:3000/route/to/serve/report/on?url_query_string_param=foobar
    ```
- At the time of writing, the value of optional parameters will be `NULL` where omitted. Therefore,
    it is up to the query author to supply a query that functions correctly when the supplied
    parameter is `NULL`. In this example, the query will succeed whether `optional_param` is equal
    to `whatever` or `NULL`.
    ```sql
    SELECT
        even, more, stuff
    FROM
        another_table
    WHERE
        whatever = $O{optional_param}
    OR
        $O{optional_param} IS NULL
    ```

#### Build
From the repo root:
```sh
docker build reports
```

#### Run
Populate an environment file with the credentials of your Mojaloop instance:
```sh
cat <<EOF >./.my.env
DB_HOST="localhost"
DB_USER="central_ledger"
DB_PASSWORD="password"
DB_DATABASE="central_ledger"
EOF
```
Where `reports` is the image name from the build stage:
```sh
docker run -v $PWD/config:/opt/reports/config -p 3000:3000 --env-file=./.my.env reports
```

#### Audit Issues
 This repository uses [npm-audit-resolver](https://github.com/naugtur/npm-audit-resolver#readme) to check for security vulnerabilities. Basic troubleshooting of a failed security check is as follows:
 1. Run `npm audit` to show the current issues.
 2. Run `npm audit fix` to attempt to automatically fix the current issues.
 3. If an issue must be ignored, and **it is absolutely safe to do so**, run `npm run audit:resolve` and select "remind me in 24h"

#### TODO
- Probably get rid of knex in favour of plain mysql2?
- The initial implementation was developed with compatibility for Jaspersoft Studio queries in
    mind. Optionally use different templating engines. Parametrise this in the config. Perhaps a
    single default global templating engine, and then a per-report override.
- OpenAPI validation on requests and responses (optionally for reports)
- Streaming. The DB lib supports streaming, so does koa. This will be especially important for
    large reports.
- Streams in the logger.
- Default values in query templates. This would be much better supported by using an existing,
    well-tested, proven templating engine and porting existing queries to said templating engine.
    (And perhaps phasing out support for the custom templates here). Also consider finding out
    whether Jaspersoft Studio uses an existing engine that we can replace our implementation with.
- Measure test coverage
- Logger: enable printing of requests as cURL- perhaps by providing a custom handler thingie
- Eslint. Side-note: make sure 'no-floating-promises' is enabled.
