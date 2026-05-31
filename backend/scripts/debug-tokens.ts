import { TokenService } from '../src/auth/token.service';

async function main() {
  const ts = new TokenService();
  console.log('ISSUER:', (ts as any).issuer);
  console.log('AUDIENCE:', (ts as any).audience);
  console.log('KEY_ID:', (ts as any).keyId);
  
  const token = process.argv[2];
  if (token) {
    console.log('VERIFYING:', token);
    const decoded = ts.verifyAccessToken(token);
    console.log('DECODED:', JSON.stringify(decoded, null, 2));
  }
}

main();
