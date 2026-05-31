import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TokenService } from '../src/auth/token.service';

async function main() {
  // We need to load env first because Nest won't do it automatically in this script
  // unless we use the same entry point logic.
  // But actually, we just want to see what the TokenService thinks the secret is.
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const tokenService = app.get(TokenService);
  
  console.log('ISSUER:', (tokenService as any).issuer);
  console.log('AUDIENCE:', (tokenService as any).audience);
  
  const token = tokenService.createAccessToken({
    id: 'cmoov6u2m0000xoy90fyilhm2',
    role: 'ADMIN',
    email: 'admin@projtrack.codes',
  });
  
  console.log('GENERATED_TOKEN:', token);
  
  await app.close();
}

main().catch(console.error);
