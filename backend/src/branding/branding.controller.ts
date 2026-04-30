import { Body, Controller, Get } from '@nestjs/common';
import { BrandingService } from './branding.service';

@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  getBranding() {
    return this.branding.getPublicBranding();
  }

  @Get('favicon')
  getFavicon() {
    const branding = this.branding.getPublicBranding();
    return {
      faviconUrl: branding.faviconUrl,
      updatedAt: branding.updatedAt,
    };
  }
}
