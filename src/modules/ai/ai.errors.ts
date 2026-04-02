import { AppError } from "../../common/errors/app-error";

export class AiNotConfiguredError extends AppError {
  constructor() {
    super(503, "Le service IA n'est pas configure");
  }
}

export class AiInputError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class AiProviderError extends AppError {
  constructor(message: string) {
    super(502, message);
  }
}

export class AiRefusalError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}

export class AiInvalidOutputError extends AppError {
  constructor(message: string) {
    super(502, message);
  }
}

