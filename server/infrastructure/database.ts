/**
 * SQLite database instance.
 *
 * The file path is resolved from DB_PATH env var so it works regardless
 * of the process working directory. Falls back to a local `sqlite.db`
 * in development.
 *
 * To use: import { db } from './database' and inject it into your
 * repository constructor.
 */
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(process.cwd(), 'sqlite.db');

export const db = new Database(dbPath);
