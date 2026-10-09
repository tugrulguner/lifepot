export type ReflectionStage = "configuration" | "reservation" | "provider" | "wire" | "probabilities" | "result";
export type ReflectionErrorClass = "Error" | "TypeError" | "SyntaxError" | "RangeError" | "ZodError" | "Other";
function classify(error: unknown): ReflectionErrorClass {
  const name = error instanceof Error ? error.name : "Other";
  return name === "Error" || name === "TypeError" || name === "SyntaxError" || name === "RangeError" || name === "ZodError" ? name : "Other";
}
/** Retain only bounded classification, never raw provider errors or messages. */
export class ReflectionStageError extends Error {
  readonly errorClass: ReflectionErrorClass;
  constructor(readonly stage: ReflectionStage, error: unknown) {
    super("Reflection request failed");
    this.name = "ReflectionStageError";
    this.errorClass = classify(error);
  }
}
export async function atReflectionStage<T>(stage: ReflectionStage, operation: () => T | Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) { throw new ReflectionStageError(stage, error); }
}
