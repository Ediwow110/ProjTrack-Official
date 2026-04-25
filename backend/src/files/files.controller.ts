import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { FilesService } from './files.service';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Post('upload-base64')
  uploadBase64(@Body() body: { fileName: string; contentBase64: string; scope?: string }, @Req() req: any) {
    return this.files.uploadBase64({
      ...body,
      uploadedByUserId: req.user?.sub,
      uploadedByRole: req.user?.role,
    });
  }

  @Roles('TEACHER', 'ADMIN')
  @Get()
  list(@Query('scope') scope?: string) {
    return this.files.list(scope);
  }

  @Roles('TEACHER', 'ADMIN')
  @Get('submission/:submissionId')
  bySubmission(@Param('submissionId') submissionId: string) {
    return this.files.listForSubmission(submissionId);
  }

  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Get('meta/:scope/:storedName')
  async meta(@Param('scope') scope: string, @Param('storedName') storedName: string, @Req() req: any) {
    return this.files.resolveForDownload(`${scope}/${storedName}`, { userId: req.user?.sub, role: req.user?.role });
  }

  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Get('download/:scope/:storedName')
  async download(@Param('scope') scope: string, @Param('storedName') storedName: string, @Req() req: any, @Res() res: any) {
    const file = await this.files.resolveForDownload(`${scope}/${storedName}`, { userId: req.user?.sub, role: req.user?.role });
    if (file.downloadUrl) {
      return res.redirect(file.downloadUrl);
    }
    return res.download(file.absolutePath, file.fileName);
  }

  @Roles('ADMIN')
  @Delete(':scope/:storedName')
  remove(@Param('scope') scope: string, @Param('storedName') storedName: string) {
    return this.files.remove(`${scope}/${storedName}`);
  }
}
