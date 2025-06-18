import { MongoServerError } from 'mongodb';

const isMongoDuplicateError = (error: unknown): error is MongoServerError => {
  return (
    error instanceof MongoServerError &&
    (error as MongoServerError).code === 11000
  );
};

export default isMongoDuplicateError;
