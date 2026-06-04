import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// passport-microsoft has no published @types/...; the strategy ctor + the
// (accessToken, refreshToken, profile, done) shape match the others so a
// minimal local declaration is enough.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import prisma from './db.js';

export function initPassport() {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
  const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: `${BASE_URL}/api/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email in Google profile'));

            let customer = await prisma.customer.findUnique({ where: { email } });
            if (!customer) {
              customer = await prisma.customer.create({
                data: {
                  email,
                  name: profile.displayName || email,
                  password: null,
                },
              });
            }
            done(null, { id: customer.id, email: customer.email, type: 'customer' as const });
          } catch (err) {
            done(err as Error);
          }
        }
      )
    );
  }

  // Microsoft / Entra ID — work-account sign-in for the inka corporate
  // use case. The same Azure AD App registration covers personal,
  // school, and work accounts when `tenant` is left at 'common'.
  // Removed Facebook deliberately (see project_inka_social_login).
  if (MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET) {
    passport.use(
      new MicrosoftStrategy(
        {
          clientID: MICROSOFT_CLIENT_ID,
          clientSecret: MICROSOFT_CLIENT_SECRET,
          callbackURL: `${BASE_URL}/api/auth/microsoft/callback`,
          scope: ['user.read'],
          tenant: 'common',
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value ?? profile._json?.mail ?? profile._json?.userPrincipalName;
            if (!email) return done(new Error('No email in Microsoft profile'));

            let customer = await prisma.customer.findUnique({ where: { email } });
            if (!customer) {
              customer = await prisma.customer.create({
                data: {
                  email,
                  name: profile.displayName || email,
                  password: null,
                },
              });
            }
            done(null, { id: customer.id, email: customer.email, type: 'customer' as const });
          } catch (err) {
            done(err as Error);
          }
        }
      )
    );
  }

  return passport;
}
