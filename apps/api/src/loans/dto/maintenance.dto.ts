import { IsBoolean, IsOptional } from 'class-validator';

export class LoanMaintenanceDto {
  /**
   * Without this the operation only reports what it would delete.
   * Confirmed transactions are never touched.
   */
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
