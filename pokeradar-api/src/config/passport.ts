import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { UserModel, getAppSettings } from '../infrastructure/database/models';
import { env } from './env';

export class SignupsDisabledError extends Error {
  constructor() {
    super('Signups are currently disabled');
    this.name = 'SignupsDisabledError';
  }
}

export class LoginDisabledError extends Error {
  constructor() {
    super('Login is currently disabled');
    this.name = 'LoginDisabledError';
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile: Profile, done) => {
      try {
        const settings = await getAppSettings();
        let user = await UserModel.findOne({ googleId: profile.id });

        if (!user) {
          if (!settings.signupsEnabled) {
            return done(new SignupsDisabledError(), undefined);
          }

          user = await UserModel.create({
            googleId: profile.id,
            email: profile.emails?.[0]?.value ?? '',
            displayName: profile.displayName,
          });
        } else if (!settings.loginEnabled && !user.isAdmin) {
          return done(new LoginDisabledError(), undefined);
        }

        user.lastLogin = new Date();
        await user.save();

        // Pass as Express.User with the fields needed by our auth system
        // The auth controller will use _doc to access the full Mongoose document
        const expressUser = {
          userId: user._id.toString(),
          email: user.email,
          _doc: user,
        };
        done(null, expressUser as Express.User);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  )
);
