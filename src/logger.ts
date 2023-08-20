let ASL_MOCK_LOGGING = true;

export const setVerboseLogging = (flag: boolean): void => {
  ASL_MOCK_LOGGING = flag;
};

export const log = (message?: unknown, ...optionalParams: unknown[]): void => {
  if (!ASL_MOCK_LOGGING) {
    return;
  }
  console.log(message, ...optionalParams);
};
