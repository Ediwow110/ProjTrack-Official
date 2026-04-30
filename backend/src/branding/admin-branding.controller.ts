import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { BrandingService } from './branding.service';
import type { BrandingUploadPayload } from './branding.constants';

@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
@Controller('admin/branding')
export class AdminBrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  getBranding() {
    return this.branding.getAdminBranding();
  }

  @Patch()
  saveBranding(@Body() body: { brandName?: string | null }) {
    return this.branding.saveBranding(body);
  }

  @Post()
  saveBrandingLegacy(@Body() body: { brandName?: string | null }) {
    return this.branding.saveBranding(body);
  }

  @Post('logo')
  uploadLogo(@Body() body: BrandingUploadPayload) {
    return this.branding.uploadAsset('logo', body);
  }

  @Post('icon')
  uploadIcon(@Body() body: BrandingUploadPayload) {
    return this.branding.uploadAsset('icon', body);
  }

  @Post('favicon')
  uploadFavicon(@Body() body: BrandingUploadPayload) {
    return this.branding.uploadAsset('favicon', body);
  }

  @Delete('reset')
  resetBranding() {
    return this.branding.resetBranding();
  }
}
