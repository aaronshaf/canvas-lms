# KB Case 15 — Thread-Unsafe Shared-Connection Race (SET ROLE vs DML)

## Context

In-process Selenium tests use two threads sharing one PG connection:
the test thread (RSpec) and the Puma server thread (handling browser
requests). A `request_mutex` serialises server requests so they don't
overlap each other, but the **test thread does not acquire this mutex**
when performing direct database operations. When the test thread runs
a long-running synchronous worker (e.g. a migration worker), the
server thread can interleave `SET ROLE` calls that break the worker's
transaction.

---

## Failure signature

```
PG::InFailedSqlTransaction: ERROR:  current transaction is aborted,
commands ignored until end of transaction block

http://.../main-entry-*.js 82:117206 Uncaught t: doFetchApi received
a bad response: 500 Internal Server Error
```

Often wrapped in `RSpec::Core::MultipleExceptionError` (the PG error
from after-hook cleanup + the JS error from `check_for_js_errors`).

**Stats signature:** moderate `build_fails`, high `flaky_fails`
(ratio ~1:30). The timing window is narrow but reproducible under CI
load.

### How to recognise it

1. A test calls a synchronous worker or long-running DB operation
   directly (not via Delayed::Job)
2. The browser has an active page that polls for progress
   (e.g. content migration status, bulk action progress)
3. The error is `PG::InFailedSqlTransaction` with no clear line in the
   test body ("Unable to find matching line from backtrace")
4. The MHTML Rails log shows `SET ROLE canvas_readonly_user`
   interleaved with the worker's DML statements

---

## Root cause

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Single Ruby Process                       │
│                                                             │
│  ┌──────────────┐      ┌──────────────────┐                │
│  │ Test Thread   │      │ Puma Server Thread│                │
│  │              │      │                  │                │
│  │ run_migration │      │ handle GET       │                │
│  │  worker.perf.│      │  /api/progress   │                │
│  │  INSERT INTO…│      │  get_context     │                │
│  │              │      │  GuardRail       │                │
│  │              │      │    SET ROLE …    │                │
│  └──────┬───────┘      └────────┬─────────┘                │
│         │                       │                           │
│         └───────┬───────────────┘                           │
│                 ▼                                           │
│     ┌────────────────────┐                                  │
│     │ Shared PG Connection│                                  │
│     │ (one transaction)   │                                  │
│     └────────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

Both threads share one PG connection because
`config.use_transactional_fixtures = true`. The `request_mutex`
serialises server requests against each other, but the test thread
does NOT acquire it when running direct DB operations.

### The race sequence

1. Test thread starts `worker.perform` — executes INSERTs/DELETEs
   on the shared PG connection
2. Browser polls `GET /api/v1/progress/:id` (every ~1 second)
3. Server thread acquires `request_mutex`, enters controller stack
4. `get_context` calls `GuardRail.activate(:secondary)` which issues
   `SET ROLE canvas_readonly_user` on the **shared** PG connection
5. Test thread's next SQL is an INSERT — but the connection now has
   `canvas_readonly_user` role, which lacks write privileges
6. PG rejects: `InsufficientPrivilege: permission denied for table …`
7. This aborts the PG transaction — every subsequent SQL from either
   thread fails with `InFailedSqlTransaction`
8. The progress poll returns 500 → browser logs JS console error
9. After-hook cleanup also fails → `MultipleExceptionError`

### Why it is intermittent

The race requires the `SET ROLE` to land exactly between two worker
SQL statements. Since progress polling happens every ~1 second and the
vulnerable worker phase (e.g. `create_attachment_associations`) is
brief, the timing window is narrow — but wide enough to hit regularly
under CI load.

---

## Fix

Wrap the synchronous worker execution in `pause_ajax`, which acquires
`request_mutex` and blocks server requests while the worker runs:

```ruby
def run_migration(content_migration = nil)
  content_migration ||= @course.content_migrations.last
  content_migration.reload
  content_migration.skip_job_progress = false
  content_migration.reset_job_progress
  worker_class = Canvas::Migration::Worker.const_get(
    Canvas::Plugin.find(content_migration.migration_type).settings["worker"]
  )
  pause_ajax do
    worker_class.new(content_migration.id).perform
  end
end
```

### Why `pause_ajax` is safe

- `pause_ajax` acquires the same `request_mutex` that the server
  middleware uses. Server requests **block and wait** (they do NOT
  error out). Once the mutex is released, queued requests process
  normally — the browser sees a delayed response, not an error.
- Asset requests (JS/CSS/images) bypass the mutex entirely
  (`asset_request?` check at line 411), so the page stays interactive.
- The migration typically takes 5–10 seconds. Browser polling handles
  delayed responses gracefully (the poll interval simply stretches).

### When to apply this pattern

Any test that:
1. Runs a synchronous worker or long-running DB writes directly
   in the test thread (not via background job)
2. Has a browser page open that polls for progress or status
3. The poll endpoint's controller path includes
   `GuardRail.activate(:secondary)` (most API endpoints do)

The same pattern applies to any `worker.perform` call — not just
content migrations. Other examples: bulk grade imports, SIS imports,
quiz statistics generation.

### Alternative approaches (considered and rejected)

- **`:ignore_js_errors`** — suppresses the JS error component but the
  `PG::InFailedSqlTransaction` would still fail the test. This is a
  symptom suppression, not a fix.
- **`disallow_requests!`** — prevents all requests but returns 503
  instead of blocking. The browser would see errors in the UI.
- **Per-SQL-statement mutex** — the test thread acquires the mutex
  around each SQL statement. Far too invasive and fragile.
- **Navigate away before running worker** — removes the polling page
  before running the worker. Reduces coverage (can't verify the
  progress UI) and changes the test flow.

---

## Files affected (QE-169)

- `spec/selenium/content_migrations/new_content_migrations_spec.rb:73`
  — `pause_ajax { worker.perform }` in shared `run_migration` helper

*Introduced: QE-169*
