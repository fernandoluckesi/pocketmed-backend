import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidCpf } from './cpf.util';

@ValidatorConstraint({ name: 'isCpf', async: false })
export class IsCpfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return isValidCpf(value);
  }

  defaultMessage(): string {
    return 'CPF inválido';
  }
}

/**
 * Validates that a property is a valid CPF (11 digits with correct check
 * digits). Accepts masked or unmasked input. Combine with @IsOptional when the
 * field is optional (e.g. patient CPF).
 */
export function IsCpf(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCpfConstraint,
    });
  };
}
