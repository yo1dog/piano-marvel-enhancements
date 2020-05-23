declare interface ILogger {
  info (message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
}

declare interface INote {
  readonly name  : string;
  readonly octave: number;
  readonly number: number;
}

declare interface INoteEvent {
  readonly note       : INote;
  readonly timestampMs: number;
}