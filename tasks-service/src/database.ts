import pg from 'pg';

let poolInstance: pg.Pool | null = null;
let sqliteInstance: any = null;
let wrapperInstance: any = null;

class PgStatement {
  constructor(private pool: pg.Pool, private sql: string) {}

  private convertSql(sql: string) {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  }

  async all(params: any[] = []) {
    const res = await this.pool.query(this.convertSql(this.sql), params);
    return res.rows;
  }

  async get(params: any[] = []) {
    const res = await this.pool.query(this.convertSql(this.sql), params);
    return res.rows[0];
  }

  async run(params: any[] = []) {
    const res = await this.pool.query(this.convertSql(this.sql), params);
    return { changes: res.rowCount, lastID: (res.rows[0] && res.rows[0].id) || 0 };
  }
}

export async function getDatabase(
  filename = process.env.NODE_ENV === 'test'
    ? ':memory:'
    : process.env.DATABASE_URL || process.env.DATABASE_PATH || './database.sqlite',
  forceNew = false
) {
  const isPostgres = filename.startsWith('postgresql://');

  if (forceNew) {
    if (poolInstance) await poolInstance.end();
    poolInstance = null;
    sqliteInstance = null;
    wrapperInstance = null;
  }
  
  if (wrapperInstance) return wrapperInstance;
  
  if (isPostgres) {
    poolInstance = new pg.Pool({ connectionString: filename });
    await poolInstance.query(`CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT UNIQUE,
        description TEXT,
        completed INTEGER DEFAULT 0
      )
    `);
    try {
      await poolInstance.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);');
    } catch (error) {
       // Ignore
    }
    wrapperInstance = createPgWrapper(poolInstance);
  } else {
    const { open } = await import('sqlite');
    const sqlite3 = await import('sqlite3');
    sqliteInstance = await open({
      filename,
      driver: sqlite3.default.Database,
    });
    await sqliteInstance.run('PRAGMA busy_timeout = 5000;');
    await sqliteInstance.exec(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT UNIQUE,
        description TEXT,
        completed INTEGER DEFAULT 0
      )
    `);
    try {
      await sqliteInstance.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);');
    } catch (error) {
       // Ignore
    }
    wrapperInstance = sqliteInstance;
  }
  
  return wrapperInstance;
}

function createPgWrapper(pool: pg.Pool) {
  const convertSql = (sql: string) => {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  };

  return {
    exec: async (sql: string) => pool.query(convertSql(sql)),
    prepare: async (sql: string) => new PgStatement(pool, sql),
    get: async (sql: string, params: any[] = []) => {
      const res = await pool.query(convertSql(sql), params);
      return res.rows[0];
    },
    run: async (sql: string, params: any[] = []) => {
      const res = await pool.query(convertSql(sql), params);
      return { changes: res.rowCount };
    },
    all: async (sql: string, params: any[] = []) => {
      const res = await pool.query(convertSql(sql), params);
      return res.rows;
    },
    close: async () => pool.end()
  } as any;
}
