import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === 'production') {
    console.warn('WARNING: DATABASE_URL is not set in production. Falling back to In-Memory storage.');
}

export const sql = databaseUrl ? neon(databaseUrl) : null;
