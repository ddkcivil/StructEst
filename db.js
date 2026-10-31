import mongoose from 'mongoose';
import { Project, MaterialRate, User } from './mongodb.schema.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Mongoose 9 rejects the removed useNewUrlParser / useUnifiedTopology
    // options, so the URI alone carries all connection behaviour.
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/structestpro');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Don't kill the process: the API still serves the AI/DXF endpoints and
    // the client degrades gracefully when the database is unavailable.
    console.error(`MongoDB connection error: ${error.message}`);
  }
};

export { connectDB, Project, MaterialRate, User };

export default { connectDB, Project, MaterialRate, User };