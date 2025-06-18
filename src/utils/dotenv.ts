import dotenv from 'dotenv';
import path from 'path';

const environment: string = process.env.NODE_ENV?.trim() ?? 'development';
const environmentPath: string = path.resolve(
  __dirname,
  `./../../.env.${environment}`
);

export default () => dotenv.config({ path: environmentPath });
