import mongoose from 'mongoose';

/**
 * MongoDBConnection component derived from SAD-component, SAD-composite, and class.png.
 * Encapsulates connection lifecycle, database handle access, and transaction capability checks.
 */
export class MongoDBConnection {
  constructor(connectionString = '', databaseName = 'hostel_booking') {
    this.connectionString = connectionString;
    this.databaseName = databaseName;
    this._supportsTransactions = false;
  }

  async connect(connectionString = this.connectionString, databaseName = this.databaseName) {
    if (connectionString) {
      this.connectionString = connectionString;
    }
    if (databaseName) {
      this.databaseName = databaseName;
    }
    if (!this.connectionString) {
      throw new Error('Cannot connect to MongoDB without connectionString.');
    }

    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    await mongoose.connect(this.connectionString, {
      dbName: this.databaseName,
      serverSelectionTimeoutMS: 8000,
    });

    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      this._supportsTransactions = Boolean(hello.setName);
    } catch {
      this._supportsTransactions = false;
    }

    return mongoose.connection;
  }

  getDatabase() {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }
    return mongoose.connection.db;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  supportsTransactions() {
    return this._supportsTransactions;
  }

  async close() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    this._supportsTransactions = false;
  }
}

export const dbConnection = new MongoDBConnection();
