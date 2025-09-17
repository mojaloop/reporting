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
      promise: jest.fn(() => mockPromiseConn),
      on: jest.fn()
    };
    mysql.createPool.mockReturnValue(mockConnPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a connection pool with default options and attach error listener', () => {
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
    expect(mockConnPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should create a connection pool with custom options and attach error listener', () => {
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
    expect(mockConnPool.on).toHaveBeenCalledWith('error', expect.any(Function));
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

  it('should pass ca in additionalConnectionOptions to createPool and attach error listener', () => {
    const caValue = '-----BEGIN CERTIFICATE-----\n...';
    new Database({
      connection: {
        additionalConnectionOptions: { ssl: { ca: caValue } }
      }
    });
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      ssl: expect.objectContaining({ ca: caValue })
    }));
    expect(mockConnPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should merge additionalConnectionOptions.ssl.ca with other ssl options and attach error listener', () => {
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
    expect(mockConnPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should not fail if additionalConnectionOptions is not provided and attach error listener', () => {
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
    expect(mockConnPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should default to empty object if pool is not provided and attach error listener', () => {
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
    expect(mockConnPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should default to empty object if connection is not provided and attach error listener', () => {
    new Database({
      pool: {
        connectionLimit: 5
      }
    });
    expect(mysql.createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: '127.0.0.1',
      connectionLimit: 5
    }));
    expect(mockConnPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should call the error listener when pool emits error', () => {
    new Database({});
    // Find the error handler attached
    const errorHandler = mockConnPool.on.mock.calls.find(
      ([event]) => event === 'error'
    )[1];
    const error = new Error('pool error');
    // Should not throw
    expect(() => errorHandler(error)).not.toThrow();
  });
  it('should recreate the pool and reassign this.conn on PROTOCOL_CONNECTION_LOST', () => {
    const db = new Database({});
    // Find the error handler attached
    const errorHandler = mockConnPool.on.mock.calls.find(
      ([event]) => event === 'error'
    )[1];

    // Mock connPool.end and mysql.createPool for recreation
    mockConnPool.end = jest.fn();
    const newMockConnPool = {
      promise: jest.fn(() => mockPromiseConn),
      on: jest.fn()
    };
    mysql.createPool.mockReturnValueOnce(newMockConnPool);

    // Simulate PROTOCOL_CONNECTION_LOST error
    const error = { code: 'PROTOCOL_CONNECTION_LOST' };
    errorHandler(error);

    expect(mockConnPool.end).toHaveBeenCalled();
    expect(mysql.createPool).toHaveBeenCalledTimes(2); // initial + recreation
    expect(newMockConnPool.promise).toHaveBeenCalled();
    expect(db.conn).toBe(mockPromiseConn);
  });
});
