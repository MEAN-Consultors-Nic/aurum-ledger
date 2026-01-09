import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  @Post('clients-contracts')
  upload() {
    return { message: 'CSV import not implemented yet' };
  }

  @Post('clients-contracts/commit')
  commit() {
    return { message: 'CSV import not implemented yet' };
  }
}
