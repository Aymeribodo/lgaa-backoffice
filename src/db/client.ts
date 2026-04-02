import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const schemaPath = resolve(process.cwd(), "src", "db", "sql", "schema.sql");
const seedsPath = resolve(process.cwd(), "src", "db", "sql", "seeds.sql");

function ensureObjectColumn(
  db: Database.Database,
  columnName: string,
  columnDefinition: string
): void {
  ensureTableColumn(db, "objects", columnName, columnDefinition);
}

function ensureTableColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  columnDefinition: string
): void {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

export function createDatabase(databasePath: string): Database.Database {
  const isInMemory = databasePath === ":memory:";
  const fullPath = isInMemory
    ? ":memory:"
    : resolve(process.cwd(), databasePath);

  if (!isInMemory) {
    mkdirSync(dirname(fullPath), { recursive: true });
  }

  const db = new Database(fullPath);

  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(schemaPath, "utf8"));
  ensureObjectColumn(db, "type_objet", "type_objet TEXT");
  ensureTableColumn(db, "history_events", "root_object_id", "root_object_id TEXT");
  ensureTableColumn(
    db,
    "history_events",
    "source_type",
    "source_type TEXT NOT NULL DEFAULT 'SYSTEM'"
  );
  ensureTableColumn(db, "history_events", "summary", "summary TEXT");
  db.exec(readFileSync(seedsPath, "utf8"));

  return db;
}
