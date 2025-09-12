const mysql = require('mysql2');
const Database = require('../../src/db');

jest.mock('mysql2');

describe('Database', () => {
  let mockConnPool, mockPromiseConn;

  beforeEach(() => {
    mockPromiseConn = {
      execute: jest.fn()
    };
    mockConnPool = {
      promise: jest.fn(() => mockPromiseConn)
    };
    mysql.createPool.mockReturnValue(mockConnPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a connection pool with default options', () => {
    new Database({});
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: '127.0.0.1',
      port: 3306,
      user: 'central_ledger',
      password: '',
      database: 'central_ledger',
      connectionLimit: 10,
      queueLimit: 0,
      namedPlaceholders: true,
      waitForConnections: true
    }));
  });

  it('should create a connection pool with custom options', () => {
    new Database({
      connection: {
        host: 'localhost',
        port: 1234,
        user: 'test_user',
        password: 'test_pass',
        database: 'test_db',
        additionalConnectionOptions: { ssl: true }
      },
      pool: {
        queueLimit: 5,
        connectionLimit: 2
      }
    });
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: 'localhost',
      port: 1234,
      user: 'test_user',
      password: 'test_pass',
      database: 'test_db',
      connectionLimit: 2,
      queueLimit: 5,
      ssl: true
    }));
  });

  it('should execute a normal query and return result[0]', async () => {
    const db = new Database({});
    mockPromiseConn.execute.mockResolvedValueOnce([['row1', 'row2'], {}]);
    const result = await db.query('SELECT * FROM table WHERE id=:id', { id: 1 });
    expect(mockPromiseConn.execute).toHaveBeenCalledWith('SELECT * FROM table WHERE id=:id', { id: 1 });
    expect(result).toEqual(['row1', 'row2']);
  });

  it('should execute a stored procedure call and return result[0][0]', async () => {
    const db = new Database({});
    mockPromiseConn.execute.mockResolvedValueOnce([[['spRow1', 'spRow2']], {}]);
    const result = await db.query('CALL my_proc(:param)', { param: 42 });
    expect(mockPromiseConn.execute).toHaveBeenCalledWith('CALL my_proc(:param)', { param: 42 });
    expect(result).toEqual(['spRow1', 'spRow2']);
  });

  it('should handle empty bindings', async () => {
    const db = new Database({});
    mockPromiseConn.execute.mockResolvedValueOnce([['row'], {}]);
    await db.query('SELECT 1');
    expect(mockPromiseConn.execute).toHaveBeenCalledWith('SELECT 1', {});
  });

  it('should throw if execute rejects', async () => {
    const db = new Database({});
    mockPromiseConn.execute.mockRejectedValueOnce(new Error('fail'));
    await expect(db.query('SELECT 1')).rejects.toThrow('fail');
  });
  it('should pass ca in additionalConnectionOptions to createPool', () => {
    const caValue = '-----BEGIN CERTIFICATE-----\n...';
    new Database({
      connection: {
        additionalConnectionOptions: { ssl: { ca: caValue } }
      }
    });
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      ssl: expect.objectContaining({ ca: caValue })
    }));
  });

  it('should merge additionalConnectionOptions.ssl.ca with other ssl options', () => {
    const additionalOptions = { ssl: { rejectUnauthorized: false, ca: 'cert' } };
    new Database({
      connection: {
        host: 'customhost',
        additionalConnectionOptions: additionalOptions
      },
      pool: {
        connectionLimit: 20
      }
    });
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: 'customhost',
      connectionLimit: 20,
      ssl: expect.objectContaining({ rejectUnauthorized: false, ca: 'cert' })
    }));
  });

  it('should not fail if additionalConnectionOptions is not provided', () => {
    expect(() => {
      new Database({
        connection: {
          host: 'nooptions'
        }
      });
    }).not.toThrow();
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: 'nooptions'
    }));
  });

  it('should default to empty object if pool is not provided', () => {
    new Database({
      connection: {
        host: 'hostonly'
      }
    });
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: 'hostonly',
      connectionLimit: 10,
      queueLimit: 0
    }));
  });

  it('should default to empty object if connection is not provided', () => {
    new Database({
      pool: {
        connectionLimit: 5
      }
    });
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: '127.0.0.1',
      connectionLimit: 5
    }));
  });
});
