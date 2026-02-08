import { env } from './config/env';
import { connectDB } from '@pokeradar/shared';
import app from './app';

async function bootstrap() {
  await connectDB(env.MONGODB_URI);

  app.listen(env.PORT, () => {
    console.log(`[API] Server running on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
