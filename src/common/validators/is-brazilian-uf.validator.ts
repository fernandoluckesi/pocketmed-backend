import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidUf } from '../crm.util';

@ValidatorConstraint({ name: 'isBrazilianUf', async: false })
export class IsBrazilianUfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return isValidUf(value);
  }

  defaultMessage(): string {
    return 'UF inválida — informe uma das 27 unidades federativas (ex: SP)';
  }
}

/**
 * Validates that a property is one of Brazil's 27 UFs, case-insensitively.
 * Used for the CRM's issuing state: the CFM web service queries by number +
 * UF, so a wrong UF makes the registration unverifiable rather than merely
 * cosmetic. Combine with @IsOptional where the field is optional.
 */
export function IsBrazilianUf(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBrazilianUfConstraint,
    });
  };
}
