import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'

// Desktop storage (DESIGN.md §4.4). Node's built-in SQLite: no native module to rebuild for
// Electron. Migrations are numbered by position; `user_version` records how many have run.
const MIGRATIONS = [
  `
  create table rides (
    id             integer primary key,
    started_at     integer not null,          -- ms since epoch (UTC)
    utc_offset_min integer not null,
    ended_at       integer,
    status         text    not null default 'active' check (status in ('active', 'finished')),
    workout_id     text,
    workout_name   text    not null,
    ftp_at_ride    integer not null,
    duration_s     integer,
    timer_s        integer,
    avg_power      real,
    np             real,
    intensity      real,
    tss            real,
    kj             real,
    avg_hr         real,
    max_hr         real,
    distance_m     real,
    feedback       text,
    fit_path       text,
    synced_at      integer
  );
  create index rides_started_at on rides (started_at);

  create table ride_samples (
    ride_id  integer not null references rides (id) on delete cascade,
    t        integer not null,
    power    integer,
    cadence  integer,
    speed    real,
    hr       integer,
    target   integer,
    segment  integer,
    paused   integer not null default 0,
    primary key (ride_id, t)
  ) without rowid;

  create table settings (
    key   text primary key,
    value text not null
  );
  `,
  `
  create table ftp_history (
    id      integer primary key,
    date    integer not null,                 -- ms since epoch
    ftp_w   integer not null,
    source  text    not null check (source in ('manual', 'ramp', '20min', 'estimate')),
    ride_id integer references rides (id) on delete set null
  );
  `,
  // E13: routes the user imported (built-ins ship with the app), and route rides.
  `
  create table routes (
    id          text    primary key,
    name        text    not null,
    description text,
    created_at  integer not null,
    points      text    not null              -- JSON [[lat, lon, ele], ...]
  );

  alter table rides add column route_id text;
  alter table ride_samples add column lat real;
  alter table ride_samples add column lon real;
  alter table ride_samples add column alt real;
  alter table ride_samples add column dist real;
  `,
  // E9: per-ride aggregates computed once when a ride is saved (DESIGN.md §4.4), imported rides.
  `
  create table ride_power_curve (
    ride_id    integer not null references rides (id) on delete cascade,
    duration_s integer not null,
    watts      real    not null,
    primary key (ride_id, duration_s)
  ) without rowid;

  create table ride_zone_time (
    ride_id integer not null references rides (id) on delete cascade,
    zone    integer not null,                 -- 1…7
    seconds integer not null,
    primary key (ride_id, zone)
  ) without rowid;

  alter table rides add column source text not null default 'recorded';
  alter table rides add column aggregates_at integer;  -- when the rows above were computed
  `,
  // E11-8: how well the ride held its ERG targets; recompute aggregates to fill it in.
  `
  alter table rides add column target_hit real;           -- share of work seconds on target
  update rides set aggregates_at = null;
  `,
  // E12-5: data from Garmin. Other activities (runs, outdoor rides) count for the training load;
  // daily wellness values feed readiness. Rides recorded by this app are not stored here.
  `
  create table external_activities (
    id             text    primary key,              -- e.g. 'garmin:123456'
    started_at     integer not null,                 -- ms since epoch (UTC)
    utc_offset_min integer not null,
    sport          text    not null,                 -- source's type key, e.g. 'running'
    name           text,
    duration_s     real    not null,
    avg_hr         real,
    tss            real,                             -- source TSS or HR-based estimate
    intensity      real,
    zone_s         text                              -- JSON seconds in Z1…Z7 (HR zones when no power)
  );
  create index external_activities_started_at on external_activities (started_at);
  create table external_daily (
    date   text not null,                            -- local YYYY-MM-DD
    source text not null,
    json   text not null,                            -- DailyWellness without the date
    primary key (date, source)
  ) without rowid;
  `,
  // E12-7: the Strava activity a ride was uploaded as.
  `
  alter table rides add column strava_id integer;
  `,
]

let db: DatabaseSync | undefined

export function getDb(): DatabaseSync {
  if (db) return db
  db = new DatabaseSync(join(app.getPath('userData'), 'cyclotron.db'))
  db.exec('pragma journal_mode = wal; pragma foreign_keys = on;')
  migrate(db)
  return db
}

function migrate(d: DatabaseSync): void {
  const row = d.prepare('pragma user_version').get() as { user_version: number }
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    transaction(d, () => {
      d.exec(MIGRATIONS[v]!)
      d.exec(`pragma user_version = ${v + 1}`)
    })
  }
}

export function transaction(d: DatabaseSync, fn: () => void): void {
  d.exec('begin')
  try {
    fn()
    d.exec('commit')
  } catch (e) {
    d.exec('rollback')
    throw e
  }
}

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('select value from settings where key = ?').get(key) as
    { value: string } | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      'insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
    )
    .run(key, value)
}

export function closeDb(): void {
  db?.close()
  db = undefined
}
