export const isDevelopment: boolean = process.env.NODE_ENV?.trim() === 'development';

export const isProduction: boolean = process.env.NODE_ENV?.trim() === 'production';

// Function to validate and throw if an environment variable is not set
export const validateEnvVar = <T>(envVar: T | undefined, varName: string): T => {
  if (envVar === undefined) {
    throw new Error(`Environment variable ${varName} is not set.`);
  }
  return envVar;
};

export const filterObj = (
  obj: { [key: string]: any },
  ...filteredFields: string[]
): { [key: string]: any } => {
  const newObj: { [key: string]: any } = {};
  Object.keys(obj).forEach((el) => {
    if (filteredFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};
