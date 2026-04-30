import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { FilesService } from './files.service';
import { UploadBase64Dto, UploadScopeDto } from './dto/upload-file.dto';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: Number(process.env.FILE_UPLOAD_MAX_MB || 20) * 1024 * 1024,
      files: 1,
    },
  }))
  uploadMultipart(@UploadedFile() file: any, @Body() body: UploadScopeDto, @Req() req: any) {
    return this.files.uploadBuffer({
      fileName: file?.originalname,
      contentType: file?.mimetype,
      buffer: file?.buffer,
      scope: body?.scope,
      uploadedByUserId: req.user?.sub,
      uploadedByRole: req.user?.role,
    });
  }

  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Post('upload-base64')
  uploadBase64(@Body() body: UploadBase64Dto, @Req() req: any) {
    return this.files.uploadBase64({
      ...body,
      uploadedByUserId: req.user?.sub,
      uploadedByRole: req.user?.role,
    });
  }

  @Roles('TEACHER', 'ADMIN')
  @Get()
  list(@Query('scope') scope: string | undefined, @Req() req: any) {
    return this.files.list(scope, { userId: req.user?.sub, role: req.user?.role });
  }

  @Roles('STUDENT', 'TEACHER', 'ADMIN')
  @Get('submission/:submissionId')
  bySubmission(@Param('submissionId') submissionId: string, @Req() req: any) {
    return this.files.listForSubmission(submissionId, { userId: req.user?.sub, role: req.user?.role });
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

  @Roles('TEACHER', 'ADMIN')
  @Delete(':scope/:storedName')
  remove(@Param('scope') scope: string, @Param('storedName') storedName: string, @Req() req: any) {
    return this.files.remove(`${scope}/${storedName}`, { userId: req.user?.sub, role: req.user?.role });
  }
}
