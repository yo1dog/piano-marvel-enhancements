export const logger: ILogger = {
  info(message: unknown, ...optionalParams: unknown[]) {
    console.log('yo1dog-pme:', message, ...optionalParams);
  },
  
  error(message: unknown, ...optionalParams: unknown[]) {
    console.error('yo1dog-pme:', message, ...optionalParams);
  }
};