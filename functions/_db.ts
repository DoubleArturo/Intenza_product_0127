import postgres from 'postgres';

export function getDb(env: any) {
    if (!env.POSTGRES_URL) {
        throw new Error('POSTGRES_URL environment variable is not set');
    }

    // Initialize postgres client with the connection string from env
    // safe to use in Cloudflare Workers (uses TCP via specific flags or native support)
    const sql = postgres(env.POSTGRES_URL, {
        ssl: 'require',
        max: 1 // Limit connections in serverless environment
    });

    return sql;
}
