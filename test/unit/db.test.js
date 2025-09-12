const KnexWrapper = require('@mojaloop/central-services-shared/src/mysql').KnexWrapper;
const Database = require('../../src/db');

jest.mock('@mojaloop/central-services-shared/src/mysql');
const mockRaw = jest.fn();

describe('Database', () => {
  let db, mockKnexInstance;

  beforeEach(() => {
    mockKnexInstance = { raw: mockRaw };
    KnexWrapper.mockImplementation(() => mockKnexInstance);
    mockRaw.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should construct KnexWrapper with default options', () => {
    db = new Database({});
    expect(KnexWrapper).toHaveBeenCalledWith(expect.objectContaining({
      knexOptions: expect.objectContaining({
        client: 'mysql2',
        connection: expect.objectContaining({
          host: '127.0.0.1',
          port: 3306,
          user: 'central_ledger',
          password: '',
          database: 'central_ledger'
        }),
        pool: { min: 0, max: 10 }
      }),
      retryOptions: expect.any(Object),
      logger: expect.anything(),
      metrics: expect.anything(),
      context: 'REPORTING_DB'
    }));
  });

  it('should construct KnexWrapper with custom options', () => {
    db = new Database({
      connection: {
        host: 'localhost',
        port: 1234,
        user: 'test_user',
        password: 'test_pass',
        database: 'test_db',
        additionalConnectionOptions: { ssl: true }
      },
      pool: {
        min: 1,
        max: 2
      },
      retry: {
        dbRetries: 5,
        dbConnectionRetryWaitMilliseconds: 500
      }
    });
    expect(KnexWrapper).toHaveBeenCalledWith(expect.objectContaining({
      knexOptions: expect.objectContaining({
        connection: expect.objectContaining({
          host: 'localhost',
          port: 1234,
          user: 'test_user',
          password: 'test_pass',
          database: 'test_db',
          ssl: true
        }),
        pool: { min: 1, max: 2 }
      }),
      retryOptions: expect.objectContaining({
        retries: 5,
        minTimeout: 500
      })
    }));
  });

  it('should execute a normal query and return result[0]', async () => {
    db = new Database({});
    mockRaw.mockResolvedValueOnce([['row1', 'row2']]);
    const result = await db.query('SELECT * FROM table WHERE id=:id', { id: 1 });
    expect(mockRaw).toHaveBeenCalledWith('SELECT * FROM table WHERE id=:id', { id: 1 });
    expect(result).toEqual(['row1', 'row2']);
  });

  it('should execute a stored procedure call and return result[0][0]', async () => {
    db = new Database({});
    mockRaw.mockResolvedValueOnce([[['spRow1', 'spRow2']]]);
    const result = await db.query('CALL my_proc(:param)', { param: 42 });
    expect(mockRaw).toHaveBeenCalledWith('CALL my_proc(:param)', { param: 42 });
    expect(result).toEqual(['spRow1', 'spRow2']);
  });

  it('should handle empty bindings', async () => {
    db = new Database({});
    mockRaw.mockResolvedValueOnce([['row']]);
    await db.query('SELECT 1');
    expect(mockRaw).toHaveBeenCalledWith('SELECT 1', {});
  });

  it('should throw if raw rejects', async () => {
    db = new Database({});
    mockRaw.mockRejectedValueOnce(new Error('fail'));
    await expect(db.query('SELECT 1')).rejects.toThrow('fail');
  });

  it('should pass ca in additionalConnectionOptions to KnexWrapper', () => {
    const caValue = '-----BEGIN CERTIFICATE-----\n...';
    db = new Database({
      connection: {
        additionalConnectionOptions: { ssl: { ca: caValue } }
      }
    });
    expect(KnexWrapper).toHaveBeenCalledWith(expect.objectContaining({
      knexOptions: expect.objectContaining({
        connection: expect.objectContaining({
          ssl: expect.objectContaining({ ca: caValue })
        })
      })
    }));
  });

  it('should merge additionalConnectionOptions.ssl.ca with other ssl options', () => {
    const additionalOptions = { ssl: { rejectUnauthorized: false, ca: 'cert' } };
    db = new Database({
      connection: {
        host: 'customhost',
        additionalConnectionOptions: additionalOptions
      },
      pool: {
        min: 2,
        max: 20
      }
    });
    expect(KnexWrapper).toHaveBeenCalledWith(expect.objectContaining({
      knexOptions: expect.objectContaining({
        connection: expect.objectContaining({
          host: 'customhost',
          ssl: expect.objectContaining({ rejectUnauthorized: false, ca: 'cert' })
        }),
        pool: { min: 2, max: 20 }
      })
    }));
  });

  it('should not fail if additionalConnectionOptions is not provided', () => {
    expect(() => {
      db = new Database({
        connection: {
          host: 'nooptions'
        }
      });
    }).not.toThrow();
    expect(KnexWrapper).toHaveBeenCalledWith(expect.objectContaining({
      knexOptions: expect.objectContaining({
        connection: expect.objectContaining({
          host: 'nooptions'
        })
      })
    }));
  });

  it('should default to empty object if pool is not provided', () => {
    db = new Database({
      connection: {
        host: 'hostonly'
      }
    });
    expect(KnexWrapper).toHaveBeenCalledWith(expect.objectContaining({
      knexOptions: expect.objectContaining({
        connection: expect.objectContaining({
          host: 'hostonly'
        }),
        pool: { min: 0, max: 10 }
      })
    }));
  });

  it('should default to empty object if connection is not provided', () => {
    db = new Database({
      pool: {
        min: 1,
        max: 5
      }
    });
    expect(KnexWrapper).toHaveBeenCalledWith(expect.objectContaining({
      knexOptions: expect.objectContaining({
        connection: expect.objectContaining({
          host: '127.0.0.1'
        }),
        pool: { min: 1, max: 5 }
      })
    }));
  });
});
