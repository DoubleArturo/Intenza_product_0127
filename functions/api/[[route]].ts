import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import users from './routes/users';
import upload from './routes/upload';
import todos from './routes/todos';
import workspace from './routes/workspace';
import heartbeat from './routes/heartbeat';
import ai from './routes/ai';

// Type definition for Bindings
export type Bindings = {
    DB: D1Database;
    BUCKET: R2Bucket;
    AI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Base API route
const api = app.basePath('/api');

// Mount routes
api.route('/users', users);
api.route('/upload', upload);
api.route('/todos', todos);
api.route('/workspace', workspace);
api.route('/heartbeat', heartbeat);
api.route('/ai', ai);

// Error handling
app.onError((err, c) => {
    console.error('Internal App Error:', err);
    return c.json({ error: 'Internal Server Error', details: err.message }, 500);
});

export const onRequest = handle(app);
