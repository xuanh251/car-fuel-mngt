import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Static Files and SPA Fallback', () => {
  const tempDist = path.resolve('temp_dist');

  it('should serve index.html for non-api paths', async () => {
    if (!fs.existsSync(tempDist)) fs.mkdirSync(tempDist);
    fs.writeFileSync(path.join(tempDist, 'index.html'), '<html>SPA</html>');

    const app = buildApp({ 
      databasePath: ':memory:',
      staticPath: tempDist 
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/some-random-page',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<html>SPA</html>');
    
    await app.close();
    fs.rmSync(tempDist, { recursive: true, force: true });
  });

  it('should return 404 for non-api path when index.html is missing', async () => {
    if (!fs.existsSync(tempDist)) fs.mkdirSync(tempDist);
    // Ensure index.html is NOT there
    if (fs.existsSync(path.join(tempDist, 'index.html'))) {
      fs.unlinkSync(path.join(tempDist, 'index.html'));
    }

    const app = buildApp({ 
      databasePath: ':memory:',
      staticPath: tempDist 
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/some-random-page',
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe('Not Found');
    
    await app.close();
    fs.rmSync(tempDist, { recursive: true, force: true });
  });
});
