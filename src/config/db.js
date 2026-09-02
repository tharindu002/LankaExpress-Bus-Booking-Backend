import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let mongodInstance = null;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lankaexpressway';

  try {
    console.log(`🔌 Attempting connection to MongoDB at: ${uri}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ MongoDB Connected successfully to database:', mongoose.connection.name);
  } catch (err) {
    console.warn('⚠️ Standard MongoDB connection failed:', err.message);
    if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb+srv')) {
      console.error('💡 MongoDB Atlas tip: Ensure your IP address is whitelisted in MongoDB Atlas Network Access (e.g. 0.0.0.0/0 for everywhere).');
    }
    
    // In production (Render/Cloud), do not fallback to MongoMemoryServer
    if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
      console.error('❌ Production database connection failed. Please check MONGODB_URI on Render environment variables and IP whitelist in MongoDB Atlas.');
      throw err;
    }

    console.log('🚀 Initializing Embedded MongoDB Server for development...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      const memoryUri = mongodInstance.getUri();
      await mongoose.connect(memoryUri);
      console.log('✅ Embedded MongoDB Connected successfully at:', memoryUri);
    } catch (memErr) {
      console.error('❌ Failed to connect to any MongoDB instance:', memErr.message);
      throw memErr;
    }
  }
};

export const closeDB = async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};
